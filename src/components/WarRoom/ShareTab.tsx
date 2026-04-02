import React from 'react';
import { MarketDataCard } from '../UltraWarRoom';

interface ShareTabProps {
  userId?: string;
  userDisplayName?: string;
  userPhotoURL?: string;
  membership?: any;
}

const ShareTab: React.FC<ShareTabProps> = ({ userId, userDisplayName, userPhotoURL, membership }) => {
  return (
    <div className="max-w-4xl mx-auto">
      <MarketDataCard
        userId={userId}
        userDisplayName={userDisplayName}
        userPhotoURL={userPhotoURL}
        membership={membership}
      />
    </div>
  );
};

export default ShareTab;
