'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getApiUrl } from '../../../utils/apiConfig';
import BackToHome from '../../../components/BackToHome';

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState<string>('');
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      setStatus('error');
      setMessage('No authorization code received. Did cTrader redirect you here?');
      return;
    }
    if (!state) {
      setStatus('error');
      setMessage('Missing profile (state). Start the connection from the Connections page.');
      return;
    }

    const savedState = sessionStorage.getItem('ctrader_oauth_state');
    if (savedState && savedState !== state) {
      setStatus('error');
      setMessage('OAuth state mismatch – possible CSRF. Please try connecting again.');
      return;
    }
    sessionStorage.removeItem('ctrader_oauth_state');

    const profileId = parseInt(state.split(':')[0], 10);
    if (Number.isNaN(profileId)) {
      setStatus('error');
      setMessage('Invalid profile.');
      return;
    }

    const controller = new AbortController();
    const apiUrl = getApiUrl();
    fetch(`${apiUrl}/api/ctrader-connections/profiles/${profileId}/oauth-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setStatus('success');
          setMessage('Connected. Tokens have been saved.');
        } else {
          setStatus('error');
          setMessage(data.message || data.error || 'Failed to complete connection.');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setStatus('error');
        setMessage('Network error. Is the backend running?');
      });

    return () => controller.abort();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-xl mx-auto">
        <BackToHome />

        <div className="mt-8 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
          <h1 className="text-xl font-semibold mb-4">cTrader OAuth Callback</h1>

          {status === 'pending' && (
            <div className="flex items-center gap-3 text-gray-300">
              <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400" />
              Exchanging code for tokens…
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <p className="text-green-400 font-medium">{message}</p>
              <Link
                href="/connections"
                className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium transition-colors"
              >
                Back to Connections
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-red-400">{message}</p>
              <Link
                href="/connections"
                className="inline-block px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
              >
                Back to Connections
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CTraderCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8 flex items-center justify-center">
          <span className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
