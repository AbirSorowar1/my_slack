// Generates database.rules.json. Realtime Database rules have no functions,
// so shared expressions are composed here and written out as plain JSON.
import { writeFileSync } from 'node:fs';

const A = 'auth != null';
const wsMember = (w) => `root.child('workspaceMembers/' + ${w} + '/' + auth.uid).exists()`;
const wsRole = (w) => `root.child('workspaceMembers/' + ${w} + '/' + auth.uid + '/role').val()`;
const wsAdmin = (w) => `(${wsRole(w)} === 'owner' || ${wsRole(w)} === 'admin')`;
const emailKey = `auth.token.email.toLowerCase().replace('.', ',')`;

const isDm = (c) => `${c}.beginsWith('dm_') && ${c}.contains(auth.uid)`;
const isGroup = (w, c) => `${c}.beginsWith('grp_') && root.child('groups/' + ${w} + '/' + ${c} + '/members/' + auth.uid).exists()`;
const publicCh = (w, c) => `root.child('channels/' + ${w} + '/' + ${c} + '/isPrivate').val() === false && ${wsMember(w)}`;
const privateCh = (w, c) => `root.child('channelMembers/' + ${w} + '/' + ${c} + '/' + auth.uid).exists()`;
// Anyone who may read a conversation may also post / react / pin inside it.
const canAccess = (w, c) => `${A} && ${wsMember(w)} && (${isDm(c)} || ${isGroup(w, c)} || ${publicCh(w, c)} || ${privateCh(w, c)})`;

const chanOwner = (w, c) => `${A} && (${wsAdmin(w)} || root.child('channels/' + ${w} + '/' + ${c} + '/createdBy').val() === auth.uid)`;
const num = (p) => `newData.child('${p}').isNumber()`;

const rules = {
  rules: {
    users: {
      '.read': A,
      '$uid': {
        '.write': `${A} && auth.uid === $uid`,
        '.validate': `newData.hasChildren(['name', 'email'])`,
        name: { '.validate': 'newData.isString() && newData.val().length <= 80' },
        bio: { '.validate': 'newData.isString() && newData.val().length <= 500' },
      },
    },
    usersByEmail: { '$ek': { '.read': A, '.write': `${A} && ${emailKey} === $ek`, '.validate': 'newData.val() === auth.uid' } },
    presence: { '.read': A, '$uid': { '.write': `${A} && auth.uid === $uid` } },
    userSettings: { '$uid': { '.read': `${A} && auth.uid === $uid`, '.write': `${A} && auth.uid === $uid` } },
    userWorkspaces: {
      '$uid': {
        '.read': `${A} && auth.uid === $uid`,
        '$wid': {
          '.write': `${A} && (auth.uid === $uid || ${wsAdmin('$wid')})`,
        },
      },
    },
    workspaces: {
      '$wid': {
        '.read': `${A} && ${wsMember('$wid')}`,
        '.write': `${A} && ((!data.exists() && newData.child('ownerId').val() === auth.uid) || ${wsAdmin('$wid')})`,
        '.validate': `newData.hasChildren(['name', 'ownerId'])`,
        name: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 60' },
      },
    },
    workspaceMembers: {
      '$wid': {
        '.read': `${A} && ${wsMember('$wid')}`,
        '$uid': {
          '.write': `${A} && (
            (!data.exists() && auth.uid === $uid && newData.child('role').val() === 'owner' && newRootData.child('workspaces/' + $wid + '/ownerId').val() === auth.uid)
            || (${wsAdmin('$wid')} && $uid !== root.child('workspaces/' + $wid + '/ownerId').val())
            || (auth.uid === $uid && !newData.exists() && $uid !== root.child('workspaces/' + $wid + '/ownerId').val())
            || (!data.exists() && auth.uid === $uid && newData.child('role').val() === root.child('invitations/byEmail/' + ${emailKey} + '/' + $wid + '/role').val())
            || (root.child('workspaces/' + $wid + '/ownerId').val() === auth.uid)
          )`.replace(/\s+/g, ' '),
        },
      },
    },
    invitations: {
      byEmail: {
        '$ek': {
          '.read': `${A} && ${emailKey} === $ek`,
          '$wid': { '.write': `${A} && (${wsAdmin('$wid')} || ${emailKey} === $ek)` },
        },
      },
      byWorkspace: {
        '$wid': {
          '.read': `${A} && ${wsAdmin('$wid')}`,
          '.write': `${A} && ${wsAdmin('$wid')}`,
          '$ek': { '.write': `${A} && (${wsAdmin('$wid')} || ${emailKey} === $ek)` },
        },
      },
    },
    channels: {
      '$wid': {
        '.read': `${A} && ${wsMember('$wid')}`,
        '$cid': {
          '.write': `${A} && ${wsMember('$wid')} && (!data.exists() || ${wsAdmin('$wid')} || data.child('createdBy').val() === auth.uid)`,
          '.validate': `newData.hasChildren(['name', 'isPrivate', 'createdBy'])`,
          name: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 40' },
        },
      },
    },
    channelMembers: {
      '$wid': {
        '$cid': {
          '.write': chanOwner('$wid', '$cid'),
          '.read': `${A} && ${wsMember('$wid')} && (root.child('channels/' + $wid + '/' + $cid + '/isPrivate').val() === false || ${privateCh('$wid', '$cid')})`,
          '$uid': {
            '.write': `${A} && ${wsMember('$wid')} && (
              (auth.uid === $uid && root.child('channels/' + $wid + '/' + $cid + '/isPrivate').val() === false)
              || (auth.uid === $uid && !root.child('channels/' + $wid + '/' + $cid).exists())
              || ${privateCh('$wid', '$cid')}
              || ${wsAdmin('$wid')}
            )`.replace(/\s+/g, ' '),
          },
        },
      },
    },
    channelPrefs: { '$uid': { '.read': `${A} && auth.uid === $uid`, '.write': `${A} && auth.uid === $uid` } },
    groups: {
      '$wid': {
        '$gid': {
          '.read': `${A} && root.child('groups/' + $wid + '/' + $gid + '/members/' + auth.uid).exists()`,
          '.write': `${A} && ${wsMember('$wid')} && (!data.exists() || data.child('members/' + auth.uid).exists())`,
        },
      },
    },
    userGroups: {
      '$uid': {
        '.read': `${A} && auth.uid === $uid`,
        '$wid': { '.write': `${A} && ${wsMember('$wid')}` },
      },
    },
    channelMeta: {
      '$wid': {
        '$cid': {
          '.read': canAccess('$wid', '$cid'),
          '.write': canAccess('$wid', '$cid'),
        },
      },
    },
    lastRead: { '$uid': { '.read': `${A} && auth.uid === $uid`, '.write': `${A} && auth.uid === $uid` } },
    messages: {
      '$wid': {
        '$cid': {
          '.read': canAccess('$wid', '$cid'),
          '.write': chanOwner('$wid', '$cid'),
          '.indexOn': ['createdAt'],
          '$mid': {
            // Create as yourself, edit your own, or moderate as admin. Reactions/pins/reply counts have their own rules below.
            '.write': `${canAccess('$wid', '$cid')} && ((!data.exists() && newData.child('senderId').val() === auth.uid) || data.child('senderId').val() === auth.uid || ${wsAdmin('$wid')})`,
            '.validate': `newData.hasChildren(['senderId', 'createdAt'])`,
            text: { '.validate': 'newData.isString() && newData.val().length <= 8000' },
            reactions: {
              '$emoji': { '$ruid': { '.write': `${canAccess('$wid', '$cid')} && auth.uid === $ruid` } },
            },
            votes: { '$opt': { '$ruid': { '.write': `${canAccess('$wid', '$cid')} && auth.uid === $ruid` } } },
            pinned: { '.write': canAccess('$wid', '$cid') },
            replyCount: { '.write': canAccess('$wid', '$cid'), '.validate': num('') .replace("newData.child('')", 'newData') },
            lastReplyAt: { '.write': canAccess('$wid', '$cid') },
          },
        },
      },
    },
    threads: {
      '$wid': {
        '$cid': {
          '.read': canAccess('$wid', '$cid'),
          '.write': chanOwner('$wid', '$cid'),
          '$pid': {
            '.write': `${A} && (${wsAdmin('$wid')} || root.child('messages/' + $wid + '/' + $cid + '/' + $pid + '/senderId').val() === auth.uid)`,
            '.indexOn': ['createdAt'],
            '$rid': {
              '.write': `${canAccess('$wid', '$cid')} && ((!data.exists() && newData.child('senderId').val() === auth.uid) || data.child('senderId').val() === auth.uid || ${wsAdmin('$wid')})`,
              reactions: { '$emoji': { '$ruid': { '.write': `${canAccess('$wid', '$cid')} && auth.uid === $ruid` } } },
            },
          },
        },
      },
    },
    pinnedMessages: {
      '$wid': { '$cid': { '.read': canAccess('$wid', '$cid'), '.write': canAccess('$wid', '$cid') } },
    },
    savedMessages: { '$uid': { '.read': `${A} && auth.uid === $uid`, '.write': `${A} && auth.uid === $uid` } },
    typing: {
      '$wid': {
        '$cid': {
          '.read': canAccess('$wid', '$cid'),
          '$uid': { '.write': `${canAccess('$wid', '$cid')} && auth.uid === $uid` },
        },
      },
    },
    files: {
      '$wid': {
        '.read': `${A} && ${wsMember('$wid')}`,
        '.write': `${A} && ${wsAdmin('$wid')}`,
        '.indexOn': ['createdAt'],
        '$fid': {
          '.write': `${A} && ${wsMember('$wid')} && ((!data.exists() && newData.child('senderId').val() === auth.uid) || data.child('senderId').val() === auth.uid || ${wsAdmin('$wid')})`,
        },
      },
    },
    notifications: {
      '$uid': {
        '.read': `${A} && auth.uid === $uid`,
        '.indexOn': ['createdAt'],
        '$nid': {
          '.write': `${A} && (auth.uid === $uid || (!data.exists() && newData.child('fromId').val() === auth.uid))`,
        },
      },
    },
    '.read': false,
    '.write': false,
  },
};

// Clean up the helper-generated validate for replyCount.
rules.rules.messages.$wid.$cid.$mid.replyCount['.validate'] = 'newData.isNumber() && newData.val() >= 0';
const json = JSON.stringify(rules, null, 2).replace(/\\n\s*/g, ' ');
writeFileSync(new URL('../database.rules.json', import.meta.url), json + '\n');
console.log('database.rules.json written');
