/**
 * Ultra Advisor — English Landing Page (/en)
 * Purpose: NVIDIA Inception reviewers & international audiences
 * Focused on AI product positioning, tech stack, and live demo CTA
 */

import React from 'react';
import {
  Eye, Brain, Cpu, TrendingUp, Zap, BarChart3, FileBarChart,
  Shield, Globe, ArrowRight, ChevronRight, FileText,
} from 'lucide-react';

const EnglishLandingPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const goTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#030712]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-black text-sm">U</span>
            </div>
            <span className="font-black text-lg tracking-tight">Ultra Advisor</span>
            <span className="text-[10px] text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">AI Platform</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#technology" className="text-slate-400 hover:text-white transition-colors">Technology</a>
            <a href="#features" className="text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#demo" className="text-slate-400 hover:text-white transition-colors">Live Demo</a>
            <button onClick={() => goTo('/')} className="text-slate-500 hover:text-slate-300 transition-colors text-xs">中文版</button>
            <button
              onClick={() => goTo('/calculator')}
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg font-bold text-sm hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all"
            >
              Try Free
            </button>
          </nav>
          <button onClick={() => goTo('/calculator')} className="md:hidden px-4 py-2 bg-blue-600 rounded-lg font-bold text-sm">
            Try Free
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 relative overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[600px] h-[600px] bg-blue-600/[0.05] rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[5%] w-[500px] h-[500px] bg-purple-600/[0.05] rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full mb-8">
            <Zap size={14} className="text-cyan-400" />
            <span className="text-cyan-400 text-xs font-bold uppercase tracking-widest">AI-Powered Financial Analytics</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-[-0.03em] leading-[1.1] mb-6">
            Financial Analysis{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Powered by AI
            </span>
          </h1>

          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            18 interactive financial tools driven by Google Gemini AI.
            From mortgage analysis to insurance gap detection — automated, visual, instant.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => goTo('/calculator')}
              className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-bold text-lg
                         hover:shadow-[0_0_50px_rgba(6,182,212,0.3)] transition-all duration-300 flex items-center gap-2"
            >
              Try AI Mortgage Analysis <ArrowRight size={20} />
            </button>
            <span className="text-slate-600 text-sm">Free — No signup required</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto mt-16">
            {[
              { value: '18', label: 'AI Tools' },
              { value: '60+', label: 'Knowledge Articles' },
              { value: '5', label: 'Gemini AI Integrations' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-black text-white">{s.value}</p>
                <p className="text-slate-500 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section id="technology" className="py-24 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-[0.4em] rounded-full">
              Technology Stack
            </span>
            <h2 className="text-4xl md:text-5xl font-black mt-8 tracking-[-0.02em]">
              Built on{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Google Gemini AI
              </span>
            </h2>
            <p className="text-slate-500 text-lg mt-4 max-w-2xl mx-auto">
              Our platform leverages Gemini 2.0 Flash for document understanding, financial analysis, and automated report generation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Eye,
                title: 'Gemini Vision OCR',
                subtitle: 'Document Intelligence',
                desc: 'Upload insurance policy documents — Gemini Vision AI extracts structured data including coverage details, premiums, and terms in seconds.',
                tech: 'Google Gemini 2.0 Flash Vision',
                color: 'blue',
              },
              {
                icon: Brain,
                title: 'AI Coverage Advisor',
                subtitle: 'Personalized Gap Analysis',
                desc: 'AI analyzes family structure, income, and existing coverage to generate personalized protection gap reports with actionable recommendations.',
                tech: 'Gemini AI + Coverage Engine',
                color: 'purple',
              },
              {
                icon: Cpu,
                title: 'AI Mortgage Insights',
                subtitle: 'Real-time Financial Analysis',
                desc: 'Input loan parameters and get AI-powered analysis of interest costs, savings strategies, and optimized repayment plans. Free to try.',
                tech: 'Gemini AI + Financial Engine',
                color: 'emerald',
              },
              {
                icon: TrendingUp,
                title: 'AI Content Engine',
                subtitle: 'Automated Report & Post Generation',
                desc: 'Generate professional PDF reports and social media content automatically, powered by Gemini natural language generation.',
                tech: 'Gemini 2.0 Flash + Threads API',
                color: 'amber',
              },
            ].map((f) => (
              <div key={f.title} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:border-cyan-500/20 transition-all duration-500 group">
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-xl bg-${f.color}-500/10 border border-${f.color}-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    <f.icon size={24} className={`text-${f.color}-400`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-white mb-1">{f.title}</h3>
                    <p className={`text-${f.color}-400 text-sm font-bold mb-3`}>{f.subtitle}</p>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">{f.desc}</p>
                    <div className="flex items-center gap-2">
                      <Cpu size={12} className="text-slate-600" />
                      <span className="text-slate-600 text-xs font-mono">{f.tech}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="features" className="py-24 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-[0.4em] rounded-full">
              How It Works
            </span>
            <h2 className="text-4xl md:text-5xl font-black mt-8 tracking-[-0.02em]">
              Three Steps to{' '}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AI Analysis
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-[60px] left-[20%] right-[20%] h-[2px] bg-gradient-to-r from-emerald-500/30 via-blue-500/30 to-purple-500/30" />

            {[
              { step: '01', icon: FileText, label: 'Input', title: 'AI Data Capture', desc: 'Upload documents or enter financial data. AI automatically recognizes and structures the information.', color: 'emerald', gradient: 'from-emerald-500 to-teal-500' },
              { step: '02', icon: BarChart3, label: 'Analyze', title: 'Smart Visualization', desc: '18 AI tools compute, generate interactive charts, and identify gaps in real-time.', color: 'blue', gradient: 'from-blue-500 to-indigo-500' },
              { step: '03', icon: FileBarChart, label: 'Output', title: 'Auto-Generated Reports', desc: 'One-click PDF reports with visual charts, data summaries, and AI recommendations.', color: 'purple', gradient: 'from-purple-500 to-pink-500' },
            ].map((s) => (
              <div key={s.step} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 text-center relative group">
                <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.2)] group-hover:scale-110 transition-transform`}>
                  <s.icon size={28} className="text-white" />
                </div>
                <div className={`text-${s.color}-400 text-xs font-black uppercase tracking-[0.3em] mb-2`}>Step {s.step}</div>
                <h3 className="text-2xl font-black text-white mb-2">{s.label}</h3>
                <p className="text-white/80 font-bold mb-3">{s.title}</p>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-24 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-[0.4em] rounded-full">
              Architecture
            </span>
            <h2 className="text-4xl md:text-5xl font-black mt-8 tracking-[-0.02em]">
              Platform Architecture
            </h2>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Frontend */}
              <div>
                <h3 className="text-blue-400 font-black text-sm uppercase tracking-widest mb-4">Frontend</h3>
                <div className="space-y-3">
                  {['React 18 + TypeScript', 'Tailwind CSS', 'Recharts Visualization', 'Progressive Web App'].map((t) => (
                    <div key={t} className="flex items-center gap-2 text-sm text-slate-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Layer */}
              <div>
                <h3 className="text-cyan-400 font-black text-sm uppercase tracking-widest mb-4">AI Engine</h3>
                <div className="space-y-3">
                  {['Google Gemini 2.0 Flash', 'Gemini Vision (OCR)', 'Financial Analysis Model', 'NLG Report Generator'].map((t) => (
                    <div key={t} className="flex items-center gap-2 text-sm text-slate-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Backend */}
              <div>
                <h3 className="text-purple-400 font-black text-sm uppercase tracking-widest mb-4">Backend</h3>
                <div className="space-y-3">
                  {['Firebase Cloud Functions', 'Firestore (NoSQL)', 'Cloud Storage', 'Vercel Edge Network'].map((t) => (
                    <div key={t} className="flex items-center gap-2 text-sm text-slate-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Data Flow */}
            <div className="mt-10 pt-8 border-t border-white/[0.06]">
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-4 text-center">Data Flow</p>
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                {['User Input', 'Gemini AI Processing', 'Structured Analysis', 'Visual Report'].map((step, i) => (
                  <React.Fragment key={step}>
                    <span className="px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 font-mono text-xs">{step}</span>
                    {i < 3 && <ChevronRight size={16} className="text-cyan-500/50" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo CTA */}
      <section id="demo" className="py-24 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-3xl p-12">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Zap size={32} className="text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-4">Try AI Analysis Now</h2>
            <p className="text-slate-400 text-lg mb-8">
              Experience real-time AI-powered mortgage analysis.
              No registration required — completely free.
            </p>
            <button
              onClick={() => goTo('/calculator')}
              className="px-10 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-bold text-lg
                         hover:shadow-[0_0_60px_rgba(6,182,212,0.4)] transition-all duration-300 flex items-center gap-2 mx-auto"
            >
              Launch AI Mortgage Calculator <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 relative">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-6 mb-6">
            {['RFC', 'CHRP', 'FCHFP', 'CFP'].map((cert) => (
              <div key={cert} className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-full">
                <Shield size={14} className="text-amber-400" />
                <span className="text-slate-400 text-sm font-black">{cert}</span>
              </div>
            ))}
          </div>
          <p className="text-slate-600 text-xs text-center">
            All tools and content reviewed by certified financial planners (RFC, CHRP, FCHFP, CFP)
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-black text-sm">U</span>
              </div>
              <div>
                <span className="font-black text-sm">Ultra Advisor</span>
                <span className="text-slate-600 text-xs ml-2">AI-Powered Financial Analytics Platform</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-600">
              <button onClick={() => goTo('/')} className="hover:text-slate-400 transition-colors">中文版</button>
              <button onClick={() => goTo('/blog')} className="hover:text-slate-400 transition-colors">Knowledge Base</button>
              <button onClick={() => goTo('/calculator')} className="hover:text-slate-400 transition-colors">Free Calculator</button>
              <a href="https://line.me/R/ti/p/@ultraadvisor" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">Contact</a>
            </div>
          </div>
          <p className="text-center text-slate-700 text-[10px] mt-8">
            © 2026 Ultra Advisor. All rights reserved. Built in Taiwan.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default EnglishLandingPage;
