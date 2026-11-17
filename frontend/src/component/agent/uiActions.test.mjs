// تشغيل: node --test src/component/agent/uiActions.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedRoute, runUiAction } from './uiActions.js';

const handlersSpy = () => {
    const calls = [];
    const h = new Proxy({}, { get: (_, k) => (...a) => calls.push([k, ...a]) });
    return { h, calls };
};

test('routes: only same-role internal paths', () => {
    assert.equal(isAllowedRoute('/teacher/students', '/teacher'), true);
    assert.equal(isAllowedRoute('/teacher/rings/abc-1/sessions?new=1', '/teacher'), true);
    assert.equal(isAllowedRoute('/admin/users', '/teacher'), false);
    assert.equal(isAllowedRoute('/teacherx/students', '/teacher'), false);
    assert.equal(isAllowedRoute('https://evil.com', '/teacher'), false);
    assert.equal(isAllowedRoute('//evil.com', '/teacher'), false);
    assert.equal(isAllowedRoute('/teacher/../admin', '/teacher'), false);
    assert.equal(isAllowedRoute('/teacher/x?a=<script>', '/teacher'), false);
    assert.equal(isAllowedRoute('/teacher/students', undefined), false);
});

test('navigate is executed only when allowed', () => {
    const { h, calls } = handlersSpy();
    assert.equal(runUiAction({ type: 'navigate', route: '/teacher/profile' }, { prefix: '/teacher', handlers: h }), true);
    assert.equal(runUiAction({ type: 'navigate', route: '/admin/users' }, { prefix: '/teacher', handlers: h }), false);
    assert.deepEqual(calls, [['navigate', '/teacher/profile']]);
});

test('modals and unknown types', () => {
    const { h, calls } = handlersSpy();
    assert.equal(runUiAction({ type: 'open_modal', modal: 'change_password' }, { prefix: '/teacher', handlers: h }), true);
    assert.equal(runUiAction({ type: 'open_modal', modal: 'drop_database' }, { prefix: '/teacher', handlers: h }), false);
    assert.equal(runUiAction({ type: 'eval', code: 'x' }, { prefix: '/teacher', handlers: h }), false);
    assert.deepEqual(calls, [['openModal', 'change_password']]);
});

test('logout never runs directly from confirm_ui without user click', () => {
    const { h, calls } = handlersSpy();
    runUiAction({ type: 'confirm_ui', text: 't', on_confirm: [{ type: 'logout' }] }, { prefix: '/teacher', handlers: h });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'showConfirm');
    assert.deepEqual(calls[0][1].onConfirm, [{ type: 'logout' }]);
});
