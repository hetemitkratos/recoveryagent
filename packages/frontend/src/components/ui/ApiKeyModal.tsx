import React, { useState, useEffect } from 'react';
import { getApiKey } from '../../api/client';
import { Card } from './Card';
import { Button } from './Button';
import { Key } from 'lucide-react';

export function ApiKeyModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleUnauthorized = () => setIsOpen(true);
    window.addEventListener('api:unauthorized', handleUnauthorized);
    
    // Check initially if no key is found in any source
    if (!getApiKey()) {
      setIsOpen(true);
    }
    
    return () => window.removeEventListener('api:unauthorized', handleUnauthorized);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('API Key is required');
      return;
    }
    localStorage.setItem('recovery_api_key', apiKey.trim());
    setIsOpen(false);
    window.location.reload(); // Reload to re-fetch queries with the new key
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-border/50">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 bg-black text-brand rounded-full flex items-center justify-center mb-4">
            <Key className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">API Key Required</h2>
          <p className="text-content-muted mt-2 text-sm">
            Please enter your API key to access the Revenue Recovery backend.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(''); }}
              placeholder="sk_test_..."
              className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
            />
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          </div>
          <Button type="submit" className="w-full h-12 text-lg">
            Authenticate
          </Button>
        </form>
      </Card>
    </div>
  );
}
