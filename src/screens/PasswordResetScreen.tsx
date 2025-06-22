import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, CheckCircleIcon, EnvelopeIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { sendPasswordResetOTP, verifyPasswordResetOTP, setNewPassword } from '../lib/auth';

interface Props {
  onBack: () => void;
}

export const PasswordResetScreen: React.FC<Props> = ({ onBack }) => {
  const [step, setStep] = useState<'email' | 'otp' | 'newPassword' | 'success'>('email');
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Countdown timer effect for OTP resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpCountdown > 0) {
      timer = setTimeout(() => {
        setOtpCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear errors when user starts typing
    if (error) setError(null);
  };

  // STEP 1: Send OTP for password reset
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email.trim()) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Sending password reset OTP to:', formData.email);
      const result = await sendPasswordResetOTP(formData.email);
      
      if (result.success) {
        console.log('Password reset OTP sent successfully');
        setStep('otp');
        setOtpCountdown(60); // Start 60 second countdown
      } else {
        console.error('Password reset OTP send failed:', result.error);
        setError(result.error || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Password reset OTP send error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: Verify OTP (creates temporary session for password reset only)
  const handleVerifyOTP = async () => {
    setError(null);

    if (!formData.otp || formData.otp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Verifying password reset OTP for:', formData.email);
      const result = await verifyPasswordResetOTP(formData.email, formData.otp);
      
      if (result.success) {
        console.log('Password reset OTP verified successfully - temporary session created');
        setStep('newPassword');
      } else {
        console.error('Password reset OTP verification failed:', result.error);
        setError(result.error || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Password reset OTP verification error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 3: Set new password and sign out user
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.newPassword || !formData.confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Setting new password and signing out user');
      const result = await setNewPassword(formData.newPassword);
      
      if (result.success) {
        console.log('New password set successfully - user has been signed out');
        setStep('success');
      } else {
        console.error('New password set failed:', result.error);
        setError(result.error || 'Failed to set new password');
      }
    } catch (error) {
      console.error('New password set error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (otpCountdown > 0) return;

    setError(null);
    setIsLoading(true);

    try {
      const result = await sendPasswordResetOTP(formData.email);
      
      if (result.success) {
        setOtpCountdown(60);
        // Clear the OTP field
        setFormData(prev => ({ ...prev, otp: '' }));
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (error) {
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
          Enter your email address and we will send you a verification code
        </p>
      </div>

      <form onSubmit={handleSendOTP}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your email address"
            required
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !formData.email.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending Code...
            </>
          ) : (
            "Send Verification Code"
          )}
        </button>
      </form>
    </div>
  );

  const renderOtpStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
        <p className="text-gray-400">
          We have sent a 6-digit code to <span className="text-white">{formData.email}</span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Verification Code
        </label>
        <input
          type="text"
          value={formData.otp}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
            handleInputChange('otp', value);
          }}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center tracking-widest text-lg"
          placeholder="000000"
          maxLength={6}
          disabled={isLoading}
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter the 6-digit code sent to your email
        </p>
      </div>

      <button
        onClick={handleVerifyOTP}
        disabled={isLoading || formData.otp.length !== 6}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Verifying...
          </>
        ) : (
          "Verify Code"
        )}
      </button>

      <div className="text-center">
        <p className="text-gray-400 text-sm">
          Did not receive the code?{' '}
          <button
            onClick={handleResendOTP}
            disabled={otpCountdown > 0 || isLoading}
            className="text-blue-400 hover:text-blue-300 transition-colors disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : 'Resend Code'}
          </button>
        </p>
      </div>
    </div>
  );

  const renderNewPasswordStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Create New Password</h2>
        <p className="text-gray-400">
          Choose a strong password for your account
        </p>
      </div>

      {/* Important Notice */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-300 mb-1">Important</h3>
            <p className="text-xs text-blue-200">
              After setting your new password, you will be signed out and need to log in again with your new password.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSetNewPassword}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => handleInputChange('newPassword', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                placeholder="Enter new password"
                required
                minLength={6}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                placeholder="Confirm new password"
                required
                minLength={6}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={isLoading || !formData.newPassword || !formData.confirmPassword}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Setting Password...
              </>
            ) : (
              "Set New Password"
            )}
          </button>
        </div>
      </form>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="space-y-6 text-center">
      <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
        <CheckCircleIcon className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Password Reset Successful!</h2>
      <p className="text-gray-400 mb-6">
        Your password has been successfully reset. You have been signed out for security. Please sign in with your new password.
      </p>
      
      <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-green-300 mb-1">Next Steps</h3>
            <p className="text-xs text-green-200">
              Use your new password to sign in to your account. Keep it safe and secure.
            </p>
          </div>
        </div>
      </div>
      
      <button
        onClick={onBack}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all"
      >
        Sign In with New Password
      </button>
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
                src="src/Picture2.png"
                alt="Zenlit"
                className="w-8 h-8 object-contain rounded mr-3"
              />
              <h1 className="text-xl font-bold text-white">Zenlit</h1>
            </div>
          </div>

          {/* Form Container */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-900/30 border border-red-700 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {step === 'email' && renderEmailStep()}
            {step === 'otp' && renderOtpStep()}
            {step === 'newPassword' && renderNewPasswordStep()}
            {step === 'success' && renderSuccessStep()}
          </div>

          {/* Help Text */}
          {step !== 'success' && (
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
