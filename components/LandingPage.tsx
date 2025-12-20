
import React, { useState } from 'react';
import { Sparkles, Play, Users, Wand2, Zap, CheckCircle2, ArrowRight, Lock, Mail, Twitter, Github, Menu, X, BookOpen, Clock, ArrowUpRight } from 'lucide-react';
import { INITIAL_ASSETS } from '../constants';
import { supabase } from '../lib/supabaseClient';

interface LandingPageProps {
  onGrantAccess: () => void;
}

// ... (BLOG_POSTS constant)

const LandingPage: React.FC<LandingPageProps> = ({ onGrantAccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [applicationStep, setApplicationStep] = useState<'form' | 'processing' | 'success'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let result;
      if (isSignUpMode) {
        result = await supabase.auth.signUp({
          email,
          password,
        });
      } else {
        result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }

      if (result.error) throw result.error;

      if (isSignUpMode && result.data.user && result.data.session === null) {
        alert('Verification email sent! Please check your inbox.');
        setIsModalOpen(false);
      }
      // If login successful, App.tsx will handle the session change
    } catch (error: any) {
      alert(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      alert(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterApp = () => {
    onGrantAccess();
  };

  // ... (scrollToSection function)

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
      {/* ... (Navigation, Hero, Showcase, Features, Blog, Pricing sections) */}

      {/* Application Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-8 relative overflow-hidden">

            {/* Modal Glow */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500" />

            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              ✕
            </button>

            {applicationStep === 'form' && (
              <div className="animate-in slide-in-from-bottom-4 duration-300">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-center mb-2">
                  {isSignUpMode ? 'Create Account' : 'Login'}
                </h3>
                <p className="text-gray-400 text-center mb-8 text-sm">
                  {isSignUpMode
                    ? 'Join AI CapCut to start generating amazing videos.'
                    : 'Welcome back! Sign in to access your projects.'}
                </p>

                <div className="space-y-4">
                  <form onSubmit={handleEmailAuth} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase">Email Address</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase">Password</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Processing...' : (isSignUpMode ? 'Sign Up' : 'Sign In')}
                    </button>
                  </form>

                  <div className="text-center text-sm">
                    <button
                      onClick={() => setIsSignUpMode(!isSignUpMode)}
                      className="text-purple-400 hover:text-purple-300"
                    >
                      {isSignUpMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                  </div>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-[#111] px-2 text-gray-400 uppercase tracking-widest">Or continue with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleSocialLogin('google')}
                      disabled={isLoading}
                      className="flex items-center justify-center gap-2 bg-[#1c1c1e] border border-[#333] text-white font-medium py-3 rounded-lg hover:bg-[#2c2c2e] transition-colors disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Google
                    </button>

                    <button
                      onClick={() => handleSocialLogin('github')}
                      disabled={isLoading}
                      className="flex items-center justify-center gap-2 bg-[#1c1c1e] border border-[#333] text-white font-medium py-3 rounded-lg hover:bg-[#2c2c2e] transition-colors disabled:opacity-50"
                    >
                      <Github className="w-4 h-4" />
                      GitHub
                    </button>
                  </div>
                </div>
              </div>
            )}

            {applicationStep === 'processing' && (
              <div className="text-center py-12 animate-in fade-in duration-300">
                <div className="w-16 h-16 border-4 border-white/10 border-t-purple-500 rounded-full animate-spin mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-2">Processing...</h3>
                <p className="text-gray-500">Please wait</p>
              </div>
            )}

            {applicationStep === 'success' && (
              <div className="text-center py-8 animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Waitlist Joined</h3>
                <p className="text-gray-400 mb-8">
                  Thank you for your interest! We'll notify you when your access is ready.
                </p>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
