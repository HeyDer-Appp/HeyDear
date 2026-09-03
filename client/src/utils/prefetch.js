import api from './api';
import { setCached } from './cache';

// Warms every other bottom-nav screen's cache the moment the dashboard
// itself loads — so navigating to Group Chats, Connections, Album or Edit
// Profile for the very first time in a session still renders instantly
// from cache instead of showing a loading state once. Fire-and-forget: a
// failure here just means that one screen falls back to its own normal
// loading state when actually opened, nothing else depends on this.
export function prefetchPortalData() {
  api.get('/group')
    .then(res => setCached('portal_groups', res.data.groups || []))
    .catch(() => {});

  api.get('/connections')
    .then(res => setCached('portal_connections', res.data.people || []))
    .catch(() => {});

  Promise.all([
    api.get('/album'),
    api.get('/portal/profile').catch(() => null),
  ]).then(([album, profile]) => {
    setCached('portal_album', {
      dinners: album.data.dinners || [],
      firstName: profile?.data?.user?.first_name || '',
    });
  }).catch(() => {});

  api.get('/portal/full-profile')
    .then(res => setCached('portal_full_profile', res.data))
    .catch(() => {});
}
