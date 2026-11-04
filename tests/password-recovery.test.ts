import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryDestination, recoveryError, recoveryMessages, validNewPassword} from '../lib/password-recovery';
import {translate} from '../lib/i18n';

test('new passwords must match and use the same length limits as registration', () => {
  assert.equal(validNewPassword('12345678', '12345678'), true);
  assert.equal(validNewPassword('x'.repeat(128), 'x'.repeat(128)), true);
  for (const [password, confirmation] of [['', ''], ['1234567', '1234567'], ['12345678', '12345679'], ['x'.repeat(129), 'x'.repeat(129)]]) {
    assert.equal(validNewPassword(password, confirmation), false);
  }
});

test('recovery exchanges the PKCE code and only redirects to the password form', async () => {
  const calls: string[] = [];
  const auth = {exchangeCodeForSession: async (code: string) => {
    calls.push(code);
    return {data: {session: {user: {id: 'user'}}}, error: null};
  }};
  assert.equal(await recoveryDestination(auth, 'https://replog.test/auth/recovery?code=valid&next=https://evil.test'), '/reset-password');
  assert.deepEqual(calls, ['valid']);
});

test('missing, expired and rejected recovery links cannot open the password form', async () => {
  let calls = 0;
  const auth = {exchangeCodeForSession: async () => {calls++; return {data: {session: null}, error: 'invalid code'};}};
  const failed = '/forgot-password?error=expired';
  for (const query of ['', '?code=', '?error=access_denied&code=ignored', '?error_code=otp_expired']) {
    assert.equal(await recoveryDestination(auth, 'https://replog.test/auth/recovery' + query), failed);
  }
  assert.equal(calls, 0);
  assert.equal(await recoveryDestination(auth, 'https://replog.test/auth/recovery?code=expired'), failed);
  assert.equal(calls, 1);
  assert.equal(await recoveryDestination({exchangeCodeForSession: async () => ({data: {session: null}, error: null})}, 'https://replog.test/auth/recovery?code=empty'), failed);
  assert.equal(await recoveryDestination({exchangeCodeForSession: async () => {throw new Error('network');}}, 'https://replog.test/auth/recovery?code=offline'), failed);
});

test('recovery errors provide actionable messages without exposing provider details', () => {
  for (const error of [{status: 429}, {code: 'over_email_send_rate_limit'}, {code: 'over_request_rate_limit'}]) {
    assert.equal(recoveryError(error), recoveryMessages.rateLimit);
  }
  for (const error of [{status: 401}, {status: 403}, {code: 'session_not_found'}, {code: 'otp_expired'}]) {
    assert.equal(recoveryError(error, true), recoveryMessages.expired);
  }
  assert.equal(recoveryError({code: 'weak_password'}, true), recoveryMessages.weakPassword);
  assert.equal(recoveryError({code: 'same_password'}, true), recoveryMessages.samePassword);
  assert.equal(recoveryError({code: 'unexpected_failure'}), recoveryMessages.sendFailed);
  assert.equal(recoveryError({code: 'unexpected_failure'}, true), recoveryMessages.updateFailed);
});

test('all recovery status and error messages have English translations', () => {
  for (const message of Object.values(recoveryMessages)) assert.notEqual(translate(message, 'en'), message);
  assert.equal(translate('Lupa kata sandi?', 'en'), 'Forgot password?');
});
