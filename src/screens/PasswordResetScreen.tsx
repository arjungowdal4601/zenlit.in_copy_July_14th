import React, { useState } from 'react';
import { ChevronLeftIcon, CheckCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { sendPasswordReset } from '../lib/auth';

interface Props {
  onBack: () => void;
}

export const PasswordResetScreen: React.FC<Props> = ({ onBack }) => {
  const [step, setStep] = useState<'email' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Sending password reset email to:', email);
      const result = await sendPasswordReset(email);
      
      if (result.success) {
        console.log('Password reset email sent successfully');
        setStep('success');
      } else {
        console.error('Password reset failed:', result.error);
        setError(result.error || 'Failed to send reset email');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderEmailStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <EnvelopeIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
        <p className="text-gray-400">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSendResetCode}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your email address"
            required
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !email.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending Reset Link...
            </>
          ) : (
            "Send Reset Link"
          )}
        </button>
      </form>

      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-300 mb-2">What happens next?</h3>
        <ul className="text-xs text-blue-200 space-y-1">
          <li>• We'll send a secure reset link to your email</li>
          <li>• Click the link to open a new password creation page</li>
          <li>• Create your new password</li>
          <li>• Return to the app and sign in with your new password</li>
        </ul>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="space-y-6 text-center">
      <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
        <CheckCircleIcon className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Check Your Email!</h2>
      <div className="space-y-4">
        <p className="text-gray-300">
          We've sent a password reset link to:
        </p>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-blue-400 font-medium">{email}</p>
        </div>
        <p className="text-gray-400 text-sm">
          Click the link in the email to reset your password. The link will expire in 1 hour for security.
        </p>
      </div>
      
      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-yellow-300 mb-2">Don't see the email?</h3>
        <ul className="text-xs text-yellow-200 space-y-1 text-left">
          <li>• Check your spam/junk folder</li>
          <li>• Make sure you entered the correct email address</li>
          <li>• Wait a few minutes - emails can sometimes be delayed</li>
          <li>• Try sending another reset link if needed</li>
        </ul>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => {
            setStep('email');
            setEmail('');
            setError(null);
          }}
          className="w-full bg-gray-700 text-white py-3 rounded-lg font-medium hover:bg-gray-600 active:scale-95 transition-all"
        >
          Send Another Reset Link
        </button>
        
        <button
          onClick={onBack}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-black overflow-y-auto mobile-scroll">
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="flex items-center mb-6">
            <button
              onClick={onBack}
              className="mr-4 p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
            >
              <ChevronLeftIcon className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center">
              <img
                src="/images/zenlit-logo.png"
                alt="Zenlit"
                className="w-8 h-8 object-contain rounded mr-3"
              />
              <h1 className="text-xl font-bold text-white">Zenlit</h1>
            </div>
          </div>

          {/* Form Container */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            {step === 'email' && renderEmailStep()}
            {step === 'success' && renderSuccessStep()}
          </div>

          {/* Help Text */}
          {step === 'email' && (
            <div className="mt-6 text-center pb-8">
              <p className="text-xs text-gray-500">
                Remember your password?{' '}
                <button
                  onClick={onBack}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Back to Sign In
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};