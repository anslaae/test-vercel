// API client for making authenticated requests through the BFF proxy

import { getStoredTokens } from '../auth/oauth';

const API_BASE = '/api'; // Proxy base path

export async function getUserInfo() {
  const tokens = getStoredTokens();
  if (!tokens) {
    throw new Error('No access token available');
  }

  const response = await fetch(`${API_BASE}/user-info/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`);
  }

  return response.json();
}

