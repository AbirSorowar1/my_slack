import { dmId, dmOther, extractMentions, canManage, canModerateMessage, canEditMessage, emailKey, formatBytes, fileKind } from '../utils/helpers';

describe('helpers & permissions', () => {
  it('builds stable DM ids regardless of order', () => {
    expect(dmId('b', 'a')).toBe(dmId('a', 'b'));
    expect(dmOther(dmId('a', 'b'), 'a')).toBe('b');
  });
  it('extracts mentions', () => {
    const members = [{ uid: 'u1', name: 'Arup Das' }, { uid: 'u2', name: 'Meem' }];
    expect(extractMentions('hi @arup.das and @meem', members).sort()).toEqual(['u1', 'u2']);
    expect(extractMentions('@here ping', members)).toEqual(['*']);
    expect(extractMentions('email a@b.com', members)).toEqual([]);
  });
  it('enforces role permissions', () => {
    expect(canManage('owner')).toBe(true);
    expect(canManage('admin')).toBe(true);
    expect(canManage('member')).toBe(false);
    expect(canEditMessage({ senderId: 'a' }, 'a')).toBe(true);
    expect(canEditMessage({ senderId: 'a' }, 'b')).toBe(false);
    expect(canModerateMessage('admin', { senderId: 'a' }, 'b')).toBe(true);
    expect(canModerateMessage('member', { senderId: 'a' }, 'b')).toBe(false);
  });
  it('formats misc values', () => {
    expect(emailKey('A.B@x.com')).toBe('a,b@x,com');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(fileKind('image/png', 'a.png')).toBe('image');
    expect(fileKind('', 'r.xlsx')).toBe('sheet');
  });
});
