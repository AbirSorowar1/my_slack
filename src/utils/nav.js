import { isDmId, isGroupId, dmOther } from './helpers';

export function convoPath(wid, cid, me, params = {}) {
  const base = isDmId(cid) ? `dm/${dmOther(cid, me)}` : isGroupId(cid) ? `group/${cid}` : `channel/${cid}`;
  const qs = new URLSearchParams(params).toString();
  return `/app/${wid}/${base}${qs ? `?${qs}` : ''}`;
}
