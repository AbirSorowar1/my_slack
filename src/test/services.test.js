import { vi } from 'vitest';

const calls = [];
vi.mock('../firebase/database', () => {
  const rec = (name) => vi.fn((...a) => { calls.push([name, a[0]?.path, ...a.slice(1)]); return Promise.resolve({ val: () => null }); });
  return {
    db: {}, ref: (_d, path) => ({ path, key: 'k1' }), push: (r) => ({ key: 'newKey', path: `${r.path}/newKey` }),
    set: rec('set'), update: rec('update'), remove: rec('remove'), get: vi.fn(() => Promise.resolve({ val: () => ({}) , exists: () => false })),
    runTransaction: rec('tx'), serverTimestamp: () => 'TS', onDisconnect: () => ({ remove: vi.fn() }),
  };
});

const { sendMessage, editMessage, deleteMessage, toggleReaction } = await import('../services/messages');
const { createChannel } = await import('../services/channels');

const user = { uid: 'u1', name: 'Ada', displayName: 'Ada', photoURL: '' };
beforeEach(() => { calls.length = 0; });

describe('services', () => {
  it('creates a message with sender and server timestamp', async () => {
    const id = await sendMessage({ user, wid: 'w', cid: 'c', text: ' hello ', members: [] });
    expect(id).toBe('newKey');
    const [, path, data] = calls.find((c) => c[0] === 'set');
    expect(path).toBe('messages/w/c/newKey');
    expect(data).toMatchObject({ senderId: 'u1', text: 'hello', createdAt: 'TS', edited: false });
  });
  it('ignores empty messages', async () => {
    expect(await sendMessage({ user, wid: 'w', cid: 'c', text: '   ' })).toBeNull();
    expect(calls).toHaveLength(0);
  });
  it('edits a message', async () => {
    await editMessage('w', 'c', 'm1', ' new ');
    expect(calls[0]).toEqual(['update', 'messages/w/c/m1', { text: 'new', edited: true, updatedAt: 'TS' }]);
  });
  it('deletes a message', async () => {
    await deleteMessage('w', 'c', 'm1');
    expect(calls.some((c) => c[0] === 'remove' && c[1] === 'messages/w/c/m1')).toBe(true);
  });
  it('adds and removes a reaction', async () => {
    await toggleReaction('w', 'c', 'm1', '👍', 'u1', false);
    await toggleReaction('w', 'c', 'm1', '👍', 'u1', true);
    expect(calls[0]).toEqual(['set', 'messages/w/c/m1/reactions/👍/u1', true]);
    expect(calls[1]).toEqual(['set', 'messages/w/c/m1/reactions/👍/u1', null]);
  });
  it('creates a channel with a normalised name and adds the creator', async () => {
    const cid = await createChannel(user, 'w', { name: 'Design Reviews!', isPrivate: true });
    expect(cid).toBe('newKey');
    const chan = calls.find((c) => c[1]?.startsWith('channels/'));
    expect(chan[2]).toMatchObject({ name: 'design-reviews', isPrivate: true, createdBy: 'u1' });
    expect(calls.some((c) => c[1] === 'channelMembers/w/newKey/u1')).toBe(true);
  });
});
