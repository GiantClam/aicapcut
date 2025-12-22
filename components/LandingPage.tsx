
import React, { useState } from 'react';
import { Sparkles, Play, Users, Wand2, Zap, CheckCircle2, ArrowRight, Lock, Mail, Twitter, Github, Menu, X, BookOpen, Clock, ArrowUpRight } from 'lucide-react';
import { INITIAL_ASSETS } from '../constants';
import { signIn } from 'next-auth/react';

interface LandingPageProps {
  onGrantAccess: () => void;
}

const BLOG_POSTS = [
  {
    id: 1,
    title: "The Rise of Agentic AI in Video Production",
    excerpt: "Why single-prompt generation is ending, and how multi-agent orchestration is taking over the creative workflow.",
    category: "Industry Trends",
    readTime: "5 min read",
    image: "https://picsum.photos/id/48/800/600",
    slug: "agentic-ai-video-production"
  },
  {
    id: 2,
    title: "How to Create Viral Shorts in Seconds",
    excerpt: "A guide to using AutoViralVid's scriptwriter agent to identify trending hooks and generate retention-optimized edits.",
    category: "Tutorials",
    readTime: "3 min read",
    image: "https://picsum.photos/id/20/800/600",
    slug: "viral-shorts-guide"
  },
  {
    id: 3,
    title: "Understanding Keyframe Interpolation",
    excerpt: "Deep dive into how our generative video models handle movement and consistency across long-form content.",
    category: "Technology",
    readTime: "7 min read",
    image: "https://picsum.photos/id/180/800/600",
    slug: "keyframe-interpolation"
  }
];

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
    alert('Email login is currently being migrated. Please use Google or GitHub login.');
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    try {
      await signIn(provider);
    } catch (error: any) {
      alert(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterApp = () => {
    onGrantAccess();
  };

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Navigation Menu Bar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 relative group">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
              <Sparkles className="w-3 h-3 text-indigo-300 absolute -top-1 -right-1" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">AutoViralVid</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Features</button>
            <button onClick={() => scrollToSection('showcase')} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Showcase</button>
            <button onClick={() => scrollToSection('blog')} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Blog</button>
            <button onClick={() => scrollToSection('pricing')} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Pricing</button>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <button onClick={() => setIsModalOpen(true)} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Login
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 text-sm font-semibold bg-white text-black rounded-full hover:bg-gray-200 transition-all hover:scale-105 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              Get Access
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#09090b] border-b border-white/10 p-6 flex flex-col gap-6 animate-in slide-in-from-top-5">
            <button onClick={() => scrollToSection('features')} className="text-lg font-medium text-gray-300">Features</button>
            <button onClick={() => scrollToSection('showcase')} className="text-lg font-medium text-gray-300">Showcase</button>
            <button onClick={() => scrollToSection('blog')} className="text-lg font-medium text-gray-300">Blog</button>
            <div className="h-px bg-white/10 my-2" />
            <button onClick={() => setIsModalOpen(true)} className="w-full py-3 bg-white/10 rounded-xl text-white font-medium">Login</button>
            <button onClick={() => setIsModalOpen(true)} className="w-full py-3 bg-white text-black rounded-xl font-bold">Apply for Access</button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <main className="pt-40 pb-20 px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-indigo-300 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Now Accepting Early Access Applications
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            Turn Ideas into <br />
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-zinc-400 bg-clip-text text-transparent">
              Viral Hits Automatically
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            The next generation of high-engagement content. AutoViralVid uses a crew of intelligent agents to write viral scripts, generate assets, and edit timelines for maximum retention.
          </p>

          <div className="flex items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-gray-200 transition-all flex items-center gap-2 group shadow-[0_0_30px_rgba(255,255,255,0.15)]"
            >
              Start Free Experience
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </main>

      {/* Video Showcase Section */}
      <section id="showcase" className="py-24 bg-[#050505] border-y border-white/5 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Made with AutoViralVid</h2>
              <p className="text-gray-400 max-w-lg">
                See what our autonomous agents can create in minutes. From cinematic trailers to viral social media clips.
              </p>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="text-indigo-400 font-medium hover:text-indigo-300 flex items-center gap-1">
              View Gallery <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {INITIAL_ASSETS.slice(0, 3).map((asset, idx) => (
              <div key={idx} className="group relative aspect-[9/16] md:aspect-video rounded-2xl overflow-hidden bg-[#111] border border-white/10 shadow-2xl transition-all hover:-translate-y-2 hover:shadow-indigo-900/10 cursor-pointer">
                {asset.type === 'video' ? (
                  <video
                    src={asset.url}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    muted
                    loop
                    // autoPlay // Disabled autoplay for performance on landing page
                    playsInline
                    onMouseOver={(e) => e.currentTarget.play().catch(() => { })}
                    onMouseOut={(e) => e.currentTarget.pause()}
                  />
                ) : (
                  <img src={asset.thumbnail || asset.url} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Showcase" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                  <span className="text-lg font-bold text-white mb-1">{asset.name}</span>
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <span className="bg-white/20 px-2 py-0.5 rounded">Remixable</span>
                    <span>· 12k views</span>
                  </div>
                </div>
                <div className="absolute top-4 right-4 w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center group-hover:bg-indigo-500 group-hover:border-indigo-500 transition-colors">
                  <Play size={16} fill="currentColor" className="ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 relative overflow-hidden scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Workflow of the Future</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Replace tedious manual editing with an intelligent crew that understands pacing, narrative, and visual engagement.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:border-indigo-500/30 group">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-500/20 transition-colors">
                <Users className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Multi-Agent Orchestration</h3>
              <p className="text-gray-400 leading-relaxed">
                Unlike simple editors, we deploy a Director, Scriptwriter, and Editor agent to collaborate on your video, ensuring narrative consistency.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:border-blue-500/30 group">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                <Wand2 className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">One-Click Generation</h3>
              <p className="text-gray-400 leading-relaxed">
                Provide a simple topic or URL. Our AI handles footage retrieval, voiceover synthesis, and subtitle alignment instantly.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:border-emerald-500/30 group">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 transition-colors">
                <Zap className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Real-Time Editing</h3>
              <p className="text-gray-400 leading-relaxed">
                Don't like the AI's cut? Jump into the timeline editor. Adjust clips, change styles, and regenerate segments on the fly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Blog / Insights Section */}
      <section id="blog" className="py-24 bg-[#080808] border-t border-white/5 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Latest Insights</h2>
              <p className="text-gray-400 max-w-lg">
                Deep dives into generative media, tutorial guides, and updates from the AutoViralVid engineering team.
              </p>
            </div>
            <button className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
              View All Articles <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {BLOG_POSTS.map((post) => (
              <article key={post.id} className="flex flex-col group cursor-pointer" onClick={() => setIsModalOpen(true)}>
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-5 bg-[#111] border border-white/10">
                  <img src={post.image} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100" />
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur border border-white/10 px-3 py-1 rounded-full text-xs font-medium text-white">
                    {post.category}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <Clock size={12} />
                    <span>{post.readTime}</span>
                    <span>·</span>
                    <span>Feb 28, 2024</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3 group-hover:text-indigo-400 transition-colors leading-snug">
                    {post.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <div className="inline-flex items-center gap-1 text-sm font-medium text-white group-hover:underline decoration-indigo-500 underline-offset-4">
                    Read Article <ArrowUpRight size={14} className="text-gray-500" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser / Footer CTA */}
      <section id="pricing" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-[#0a0a0a]" />
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to transform your workflow?</h2>
          <p className="text-xl text-gray-400 mb-10">Join the waiting list today and get 50% off your first month of AutoViralVid Pro.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full sm:w-80 bg-white/5 border border-white/10 rounded-full px-6 py-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-colors"
            >
              Get Early Access
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-white/10 bg-[#050505] text-sm">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <span className="font-bold text-lg text-white">AutoViralVid</span>
            </div>
            <p className="text-gray-500 leading-relaxed">
              Empowering creators with autonomous multi-agent video production workflows. From script to final cut in minutes.
            </p>
            <div className="flex gap-4 pt-2">
              <a href="#" className="text-gray-500 hover:text-white transition-colors"><Twitter size={18} /></a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors"><Github size={18} /></a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors"><Mail size={18} /></a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6">Product</h4>
            <ul className="space-y-3 text-gray-500">
              <li><button onClick={() => scrollToSection('features')} className="hover:text-indigo-400 transition-colors text-left">Features</button></li>
              <li><button onClick={() => scrollToSection('showcase')} className="hover:text-indigo-400 transition-colors text-left">Showcase</button></li>
              <li><button onClick={() => scrollToSection('pricing')} className="hover:text-indigo-400 transition-colors text-left">Pricing</button></li>
              <li><button onClick={() => setIsModalOpen(true)} className="hover:text-indigo-400 transition-colors text-left">Enterprise</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6">Resources</h4>
            <ul className="space-y-3 text-gray-500">
              <li><button onClick={() => scrollToSection('blog')} className="hover:text-indigo-400 transition-colors text-left">Blog</button></li>
              <li><a href="#" className="hover:text-indigo-400 transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-indigo-400 transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-indigo-400 transition-colors">Help Center</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6">Legal</h4>
            <ul className="space-y-3 text-gray-500">
              <li><a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-indigo-400 transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-600 text-xs">
          <p>&copy; {new Date().getFullYear()} AutoViralVid. All rights reserved.</p>
          <p className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> San Francisco, CA</p>
        </div>
      </footer>

      {/* Application Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-8 relative overflow-hidden">

            {/* Modal Glow */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500" />

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
                    ? 'Join AutoViralVid to start generating amazing videos.'
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
                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
                      className="text-indigo-400 hover:text-indigo-300"
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
                <div className="w-16 h-16 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6" />
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
