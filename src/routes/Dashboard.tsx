import React from 'react';

const Dashboard: React.FC<{ loginOnly?: boolean }> = ({ loginOnly }) => {
  return <div>{loginOnly ? 'Login Only' : 'Dashboard'}</div>;
};

export default Dashboard;
