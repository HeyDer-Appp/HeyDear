import React from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useCachedFetch } from '../utils/useCachedFetch';

const AVATAR = 'https://heyder.nz/wp-content/uploads/2026/06/account-2.png';

// Top-right entry to the profile screen: the member's own photo, tap to open.
// Shares the dashboard's 'portal_profile' cache, so on every screen after
// the first it paints instantly with no extra loading state.
export default function ProfileAvatar() {
  const { data } = useCachedFetch('portal_profile', async () => {
    try {
      const res = await api.get('/portal/profile');
      return { user: res.data.user, hasActiveSubscription: !!res.data.hasActiveSubscription, needsProfile: false };
    } catch (err) {
      if (err.response?.status === 404) return { user: null, hasActiveSubscription: false, needsProfile: true };
      throw err;
    }
  });

  return (
    <Link to="/portal/profile" aria-label="Your profile" className="block w-9 h-9 rounded-full overflow-hidden border border-navy/25 flex-shrink-0">
      <img src={data?.user?.photo || AVATAR} alt="" className="w-full h-full object-cover" draggable={false} />
    </Link>
  );
}
