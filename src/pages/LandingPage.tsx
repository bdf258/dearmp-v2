import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  Clock,
  Users,
  FileText,
  Zap,
  Shield,
  CheckCircle2,
  ArrowRight,
  Inbox,
  Tag,
  UserCheck,
  FolderOpen,
  BarChart3,
  MessageSquare,
  Play,
  Sparkles,
  Timer,
  MousePointer2,
  Layers,
} from 'lucide-react';

// Animated counter component
function AnimatedNumber({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const countRef = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let startTime: number;
          const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            setCount(Math.floor(progress * end));
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    if (countRef.current) {
      observer.observe(countRef.current);
    }

    return () => observer.disconnect();
  }, [end, duration, hasAnimated]);

  return <span ref={countRef}>{count}{suffix}</span>;
}

// Typing animation for the hero
function TypingText({ texts, className }: { texts: string[]; className?: string }) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const text = texts[currentTextIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (currentText.length < text.length) {
          setCurrentText(text.slice(0, currentText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (currentText.length > 0) {
          setCurrentText(text.slice(0, currentText.length - 1));
        } else {
          setIsDeleting(false);
          setCurrentTextIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, isDeleting ? 50 : 100);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentTextIndex, texts]);

  return (
    <span className={className}>
      {currentText}
      <span className="animate-pulse">|</span>
    </span>
  );
}

// Email card component for demos
interface EmailCardProps {
  subject: string;
  from: string;
  preview: string;
  time: string;
  status?: 'new' | 'triaged' | 'processing';
  priority?: 'urgent' | 'high' | 'normal';
  onClick?: () => void;
  isActive?: boolean;
}

function EmailCard({ subject, from, preview, time, status = 'new', priority, onClick, isActive }: EmailCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 border rounded-lg cursor-pointer transition-all duration-300 ${
        isActive
          ? 'border-primary bg-primary/5 shadow-md scale-[1.02]'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{subject}</p>
            {priority === 'urgent' && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Urgent</Badge>
            )}
            {priority === 'high' && (
              <Badge className="bg-orange-500 text-[10px] px-1.5 py-0">High</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{from}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {status === 'triaged' && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          {status === 'processing' && (
            <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// HERO DEMO 1: Interactive Triage Flow
// ============================================
function HeroDemo1() {
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const steps = [
    { label: 'Email arrives', icon: Mail },
    { label: 'AI categorizes', icon: Sparkles },
    { label: 'Assign constituent', icon: UserCheck },
    { label: 'Create case', icon: FolderOpen },
    { label: 'Done!', icon: CheckCircle2 },
  ];

  useEffect(() => {
    if (isPlaying && step < steps.length - 1) {
      const timer = setTimeout(() => setStep(s => s + 1), 1500);
      return () => clearTimeout(timer);
    } else if (step === steps.length - 1) {
      setTimeout(() => {
        setStep(0);
        setIsPlaying(false);
      }, 2000);
    }
  }, [step, isPlaying, steps.length]);

  const handlePlay = () => {
    setStep(0);
    setIsPlaying(true);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Interactive Triage Flow</CardTitle>
            <CardDescription>Watch an email get processed in seconds</CardDescription>
          </div>
          <Button onClick={handlePlay} disabled={isPlaying} size="sm">
            <Play className="h-4 w-4 mr-2" />
            {isPlaying ? 'Processing...' : 'Start Demo'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Progress Steps */}
        <div className="relative mb-8">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted" />
          <div
            className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500"
            style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
          />
          <div className="relative flex justify-between">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      i <= step
                        ? 'bg-primary text-primary-foreground scale-110'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`mt-2 text-xs text-center ${i <= step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Simulated Email */}
        <div className={`border rounded-lg p-4 transition-all duration-500 ${step >= 1 ? 'border-primary/50 bg-primary/5' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Housing Benefit Appeal</p>
              <p className="text-xs text-muted-foreground">john.smith@example.com</p>
            </div>
            {step >= 1 && (
              <Badge className="animate-in fade-in slide-in-from-right">
                <Sparkles className="h-3 w-3 mr-1" />
                Housing
              </Badge>
            )}
          </div>

          {/* Triage Actions */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className={`p-2 rounded border text-center transition-all duration-300 ${step >= 2 ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}`}>
              <UserCheck className={`h-4 w-4 mx-auto mb-1 ${step >= 2 ? 'text-green-600' : 'text-muted-foreground'}`} />
              <span className="text-[10px]">Constituent</span>
              {step >= 2 && <p className="text-[10px] font-medium text-green-600">John Smith</p>}
            </div>
            <div className={`p-2 rounded border text-center transition-all duration-300 ${step >= 3 ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''}`}>
              <FolderOpen className={`h-4 w-4 mx-auto mb-1 ${step >= 3 ? 'text-blue-600' : 'text-muted-foreground'}`} />
              <span className="text-[10px]">Case</span>
              {step >= 3 && <p className="text-[10px] font-medium text-blue-600">#2024-0847</p>}
            </div>
            <div className={`p-2 rounded border text-center transition-all duration-300 ${step >= 4 ? 'border-primary bg-primary/10' : ''}`}>
              <CheckCircle2 className={`h-4 w-4 mx-auto mb-1 ${step >= 4 ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-[10px]">Status</span>
              {step >= 4 && <p className="text-[10px] font-medium text-primary">Complete</p>}
            </div>
          </div>
        </div>

        {/* Time Saved */}
        {step >= 4 && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 animate-in fade-in slide-in-from-bottom">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Timer className="h-4 w-4" />
              <span className="text-sm font-medium">Triaged in 12 seconds</span>
              <span className="text-xs text-green-600 dark:text-green-500 ml-auto">vs 5+ minutes manually</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// HERO DEMO 2: Before/After Split View
// ============================================
function HeroDemo2() {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      setSliderPosition(Math.max(10, Math.min(90, x)));
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => isDragging && handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => isDragging && handleMove(e.touches[0].clientX);
    const handleUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchend', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-lg">Before & After Comparison</CardTitle>
        <CardDescription>Drag the slider to compare workflows</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={containerRef}
          className="relative h-[400px] select-none cursor-col-resize"
          onMouseDown={() => setIsDragging(true)}
          onTouchStart={() => setIsDragging(true)}
        >
          {/* Before Side (Manual Process) */}
          <div
            className="absolute inset-0 bg-red-50 dark:bg-red-950/30 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <div className="p-6 h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-400">Before: Manual Process</p>
                  <p className="text-xs text-red-600 dark:text-red-500">4+ hours daily</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Cluttered inbox simulation */}
                <div className="p-3 bg-white dark:bg-card rounded border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 text-xs text-red-600 mb-2">
                    <Inbox className="h-3 w-3" />
                    <span>Inbox: 247 unread</span>
                  </div>
                  <div className="space-y-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="h-8 bg-red-100 dark:bg-red-900/50 rounded animate-pulse" style={{animationDelay: `${i * 0.1}s`}} />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white dark:bg-card rounded border border-red-200 dark:border-red-800">
                    <p className="text-red-600">Manual sorting</p>
                    <p className="text-red-800 dark:text-red-300 font-medium">45 min</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-card rounded border border-red-200 dark:border-red-800">
                    <p className="text-red-600">Copy to CRM</p>
                    <p className="text-red-800 dark:text-red-300 font-medium">60 min</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-card rounded border border-red-200 dark:border-red-800">
                    <p className="text-red-600">Create cases</p>
                    <p className="text-red-800 dark:text-red-300 font-medium">90 min</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-card rounded border border-red-200 dark:border-red-800">
                    <p className="text-red-600">Assign work</p>
                    <p className="text-red-800 dark:text-red-300 font-medium">45 min</p>
                  </div>
                </div>

                <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">4+ hours</p>
                  <p className="text-xs text-red-600">wasted every day</p>
                </div>
              </div>
            </div>
          </div>

          {/* After Side (DearMP) */}
          <div
            className="absolute inset-0 bg-green-50 dark:bg-green-950/30 overflow-hidden"
            style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
          >
            <div className="p-6 h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-400">After: With DearMP</p>
                  <p className="text-xs text-green-600 dark:text-green-500">15 minutes</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Organized inbox simulation */}
                <div className="p-3 bg-white dark:bg-card rounded border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-xs text-green-600 mb-2">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Smart Triage Queue</span>
                  </div>
                  <div className="space-y-1">
                    {['Housing', 'Benefits', 'Immigration'].map((cat, i) => (
                      <div key={i} className="h-8 bg-green-100 dark:bg-green-900/50 rounded flex items-center px-2 text-xs text-green-700 dark:text-green-300">
                        <Badge variant="outline" className="text-[10px] mr-2">{cat}</Badge>
                        Auto-categorized
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white dark:bg-card rounded border border-green-200 dark:border-green-800">
                    <p className="text-green-600">AI sorting</p>
                    <p className="text-green-800 dark:text-green-300 font-medium">Instant</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-card rounded border border-green-200 dark:border-green-800">
                    <p className="text-green-600">Auto-link</p>
                    <p className="text-green-800 dark:text-green-300 font-medium">Instant</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-card rounded border border-green-200 dark:border-green-800">
                    <p className="text-green-600">One-click case</p>
                    <p className="text-green-800 dark:text-green-300 font-medium">5 sec</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-card rounded border border-green-200 dark:border-green-800">
                    <p className="text-green-600">Smart assign</p>
                    <p className="text-green-800 dark:text-green-300 font-medium">Auto</p>
                  </div>
                </div>

                <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">15 min</p>
                  <p className="text-xs text-green-600">for everything</p>
                </div>
              </div>
            </div>
          </div>

          {/* Slider Handle */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-primary cursor-col-resize"
            style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
              <MousePointer2 className="h-5 w-5" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// HERO DEMO 3: Stacked Card Animation
// ============================================
function HeroDemo3() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const features = [
    {
      title: 'Smart Email Triage',
      description: 'AI-powered categorization instantly sorts incoming emails by topic, urgency, and constituent. No more manual reading through hundreds of emails.',
      icon: Mail,
      color: 'from-blue-500 to-cyan-500',
      stats: { label: 'Emails processed', value: '50,000+', sublabel: 'per month' }
    },
    {
      title: 'One-Click Case Creation',
      description: 'Create cases, link constituents, and assign caseworkers in a single workflow. Everything connected automatically.',
      icon: FolderOpen,
      color: 'from-purple-500 to-pink-500',
      stats: { label: 'Time to create case', value: '10 sec', sublabel: 'vs 5 min manual' }
    },
    {
      title: 'Campaign Management',
      description: 'Handle coordinated email campaigns efficiently. Group similar emails and send bulk responses with MP approval.',
      icon: Users,
      color: 'from-orange-500 to-red-500',
      stats: { label: 'Campaign emails', value: '1,000+', sublabel: 'handled in minutes' }
    },
    {
      title: 'Complete Audit Trail',
      description: 'Every action logged and traceable. Full compliance with parliamentary standards and data protection requirements.',
      icon: Shield,
      color: 'from-green-500 to-emerald-500',
      stats: { label: 'Compliance', value: '100%', sublabel: 'audit ready' }
    },
  ];

  useEffect(() => {
    if (isAutoPlaying) {
      const timer = setInterval(() => {
        setActiveIndex(prev => (prev + 1) % features.length);
      }, 4000);
      return () => clearInterval(timer);
    }
  }, [isAutoPlaying, features.length]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Feature Showcase</CardTitle>
            <CardDescription>Click cards or watch the animation</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          >
            {isAutoPlaying ? 'Pause' : 'Auto-play'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Feature Cards Stack */}
          <div className="relative h-[300px]">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const offset = index - activeIndex;
              const isActive = index === activeIndex;

              return (
                <div
                  key={index}
                  onClick={() => {
                    setActiveIndex(index);
                    setIsAutoPlaying(false);
                  }}
                  className={`absolute inset-0 rounded-xl border bg-card p-6 cursor-pointer transition-all duration-500 ${
                    isActive ? 'shadow-xl z-10' : 'shadow-md'
                  }`}
                  style={{
                    transform: `translateY(${offset * 8}px) scale(${1 - Math.abs(offset) * 0.05})`,
                    opacity: Math.abs(offset) > 2 ? 0 : 1 - Math.abs(offset) * 0.2,
                    zIndex: features.length - Math.abs(offset),
                  }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>

          {/* Stats Display */}
          <div className="flex flex-col justify-center">
            <div
              className={`p-6 rounded-xl bg-gradient-to-br ${features[activeIndex].color} text-white transition-all duration-500`}
            >
              <p className="text-sm opacity-90 mb-2">{features[activeIndex].stats.label}</p>
              <p className="text-5xl font-bold mb-1">{features[activeIndex].stats.value}</p>
              <p className="text-sm opacity-75">{features[activeIndex].stats.sublabel}</p>
            </div>

            {/* Navigation Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {features.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setActiveIndex(index);
                    setIsAutoPlaying(false);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === activeIndex ? 'w-8 bg-primary' : 'bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN LANDING PAGE
// ============================================
export default function LandingPage() {
  const [heroEmailIndex, setHeroEmailIndex] = useState(0);

  const heroEmails = [
    { subject: 'Housing Benefit Appeal - Urgent', from: 'john.smith@email.com', preview: 'I am writing regarding the decision on my housing benefit application...', time: '2 min', priority: 'urgent' as const },
    { subject: 'Pothole on Main Street', from: 'sarah.jones@email.com', preview: 'There has been a dangerous pothole outside our house for three weeks...', time: '5 min', priority: 'normal' as const },
    { subject: 'RE: Passport Application Query', from: 'david.wilson@email.com', preview: 'Thank you for your previous response. I have a follow-up question...', time: '12 min', priority: 'normal' as const },
    { subject: 'Universal Credit Sanctions', from: 'emma.brown@email.com', preview: 'My universal credit has been sanctioned unfairly and I need help...', time: '18 min', priority: 'high' as const },
    { subject: 'Planning Permission Objection', from: 'local.residents@email.com', preview: 'We are a group of residents concerned about the proposed development...', time: '25 min', priority: 'normal' as const },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">DearMP</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
              <a href="#demos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Demo</a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm">Sign In</Button>
              <Button size="sm">Get Started</Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Copy */}
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="secondary" className="mb-4">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Built for UK Parliamentary Offices
                </Badge>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                  Triage constituent emails in{' '}
                  <span className="text-primary">
                    <TypingText
                      texts={['15 minutes', 'record time', 'one click']}
                      className="inline"
                    />
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-xl">
                  Transform your casework inbox from a 4-hour daily burden into a 15-minute streamlined process.
                  AI-powered triage, instant case creation, and complete constituent tracking.
                </p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-3xl font-bold text-primary">
                    <AnimatedNumber end={94} suffix="%" />
                  </p>
                  <p className="text-sm text-muted-foreground">Time saved on triage</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">
                    <AnimatedNumber end={15} suffix=" min" />
                  </p>
                  <p className="text-sm text-muted-foreground">Daily email processing</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">
                    <AnimatedNumber end={50} suffix="+" />
                  </p>
                  <p className="text-sm text-muted-foreground">MP offices served</p>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="text-base">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" className="text-base">
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="flex items-center gap-6 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>UK GDPR Compliant</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Parliamentary Standards</span>
                </div>
              </div>
            </div>

            {/* Right Column - Interactive Email Demo */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-chart-3/20 rounded-3xl blur-3xl opacity-50" />
              <Card className="relative">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Inbox className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Triage Queue</span>
                    </div>
                    <Badge variant="secondary">
                      {heroEmails.length} emails waiting
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {heroEmails.map((email, index) => (
                    <EmailCard
                      key={index}
                      {...email}
                      isActive={index === heroEmailIndex}
                      status={index < heroEmailIndex ? 'triaged' : index === heroEmailIndex ? 'processing' : 'new'}
                      onClick={() => setHeroEmailIndex(index)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">
              The Hidden Cost of Manual Email Triage
            </h2>
            <p className="text-lg text-muted-foreground">
              Every day, parliamentary caseworkers spend hours on repetitive tasks that should take minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>4+ Hours Daily</CardTitle>
                <CardDescription>
                  The average time spent sorting, categorizing, and processing incoming constituent emails manually.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>Duplicate Work</CardTitle>
                <CardDescription>
                  Copying details between email, CRM, and case management systems. Triple data entry for every case.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>Missed Context</CardTitle>
                <CardDescription>
                  Without linked records, caseworkers miss previous correspondence and constituent history.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4">Features</Badge>
            <h2 className="text-3xl font-bold mb-4">
              Everything You Need to Manage Casework
            </h2>
            <p className="text-lg text-muted-foreground">
              A complete system designed specifically for the unique needs of UK parliamentary offices.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Mail,
                title: 'Smart Email Triage',
                description: 'AI categorizes emails by topic and urgency. Constituent details are auto-extracted and matched.',
              },
              {
                icon: FolderOpen,
                title: 'Instant Case Creation',
                description: 'One click to create a case, link the constituent, assign priority, and route to the right caseworker.',
              },
              {
                icon: Users,
                title: 'Constituent Database',
                description: 'Complete contact history, case records, and relationship tracking for every constituent.',
              },
              {
                icon: Tag,
                title: 'Campaign Management',
                description: 'Handle coordinated campaigns efficiently. Group emails, draft responses, and get MP approval.',
              },
              {
                icon: BarChart3,
                title: 'Reporting & Analytics',
                description: 'Track response times, case volumes, and caseworker workload. Export for parliamentary reports.',
              },
              {
                icon: Shield,
                title: 'Audit & Compliance',
                description: 'Complete audit trail for every action. GDPR compliant with parliamentary security standards.',
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="group hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-4 transition-colors">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl font-bold mb-4">
              From Inbox to Case in Seconds
            </h2>
            <p className="text-lg text-muted-foreground">
              Our streamlined workflow turns hours of manual work into a quick, guided process.
            </p>
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden lg:block absolute top-24 left-[calc(16.67%-1rem)] right-[calc(16.67%-1rem)] h-0.5 bg-border" />

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  step: 1,
                  title: 'Email Arrives',
                  description: 'Emails from your Outlook inbox are automatically imported and queued for triage.',
                  icon: Inbox,
                },
                {
                  step: 2,
                  title: 'AI Analysis',
                  description: 'Our AI reads the email, extracts constituent details, and suggests categorization.',
                  icon: Sparkles,
                },
                {
                  step: 3,
                  title: 'Quick Triage',
                  description: 'Review AI suggestions, confirm or adjust, then create or link to a case in one click.',
                  icon: MousePointer2,
                },
                {
                  step: 4,
                  title: 'Case Created',
                  description: 'Case is created with all details, constituent linked, and assigned to the right caseworker.',
                  icon: FolderOpen,
                },
                {
                  step: 5,
                  title: 'Work Begins',
                  description: 'Caseworker sees full context: previous cases, correspondence history, and contact details.',
                  icon: FileText,
                },
                {
                  step: 6,
                  title: 'Track Progress',
                  description: 'Monitor case status, set reminders, and generate reports for parliamentary accountability.',
                  icon: BarChart3,
                },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="relative">
                    <div className="bg-background rounded-xl p-6 border shadow-sm">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                          {item.step}
                        </div>
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demos Section */}
      <section id="demos" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4">
              <Layers className="h-3 w-3 mr-1" />
              Interactive Demos
            </Badge>
            <h2 className="text-3xl font-bold mb-4">
              See DearMP in Action
            </h2>
            <p className="text-lg text-muted-foreground">
              Explore these interactive demonstrations to see how DearMP transforms your casework workflow.
            </p>
          </div>

          <div className="space-y-8">
            {/* Demo 1: Interactive Triage Flow */}
            <div className="grid lg:grid-cols-2 gap-8 items-start">
              <div className="lg:order-2">
                <Badge className="mb-4">Demo 1</Badge>
                <h3 className="text-2xl font-bold mb-4">Interactive Triage Flow</h3>
                <p className="text-muted-foreground mb-6">
                  Watch how an email moves through the triage process in real-time. From arrival to completed case
                  in under 15 seconds. Click "Start Demo" to see the magic happen.
                </p>
                <ul className="space-y-3">
                  {[
                    'AI-powered instant categorization',
                    'Automatic constituent matching',
                    'One-click case creation',
                    'Smart caseworker assignment',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:order-1">
                <HeroDemo1 />
              </div>
            </div>

            {/* Demo 2: Before/After Comparison */}
            <div className="grid lg:grid-cols-2 gap-8 items-start">
              <div>
                <Badge className="mb-4">Demo 2</Badge>
                <h3 className="text-2xl font-bold mb-4">Before & After Comparison</h3>
                <p className="text-muted-foreground mb-6">
                  Drag the slider to compare your current manual workflow with the DearMP experience.
                  See exactly where time is saved at each step of the process.
                </p>
                <ul className="space-y-3">
                  {[
                    'Visual time comparison',
                    'Step-by-step breakdown',
                    'Real efficiency metrics',
                    'Interactive exploration',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <HeroDemo2 />
              </div>
            </div>

            {/* Demo 3: Feature Showcase */}
            <div className="grid lg:grid-cols-2 gap-8 items-start">
              <div className="lg:order-2">
                <Badge className="mb-4">Demo 3</Badge>
                <h3 className="text-2xl font-bold mb-4">Feature Showcase</h3>
                <p className="text-muted-foreground mb-6">
                  Explore all the key features of DearMP with this animated showcase. Click on any card to
                  learn more, or let it auto-play to see everything the system has to offer.
                </p>
                <ul className="space-y-3">
                  {[
                    'Smart email triage',
                    'One-click case creation',
                    'Campaign management',
                    'Complete audit trail',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:order-1">
                <HeroDemo3 />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4">Testimonials</Badge>
            <h2 className="text-3xl font-bold mb-4">
              Trusted by Parliamentary Offices
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "We went from spending half the day on email to having cases created before our morning coffee. The time savings are incredible.",
                author: "Senior Caseworker",
                office: "Westminster Office",
              },
              {
                quote: "The AI categorization is remarkably accurate. It correctly identifies housing, benefits, and immigration cases 95% of the time.",
                author: "Office Manager",
                office: "Constituency Office",
              },
              {
                quote: "Finally, a system that understands how parliamentary offices actually work. The campaign management alone has transformed how we handle bulk correspondence.",
                author: "MP's Chief of Staff",
                office: "Parliamentary Office",
              },
            ].map((testimonial, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="w-4 h-4 rounded-full bg-primary" />
                    ))}
                  </div>
                  <blockquote className="text-lg mb-4">"{testimonial.quote}"</blockquote>
                  <div>
                    <p className="font-medium">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.office}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Transform Your Casework?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join parliamentary offices across the UK who have reclaimed hours of their day with DearMP.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" className="text-base">
              Start 14-Day Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-base">
              <MessageSquare className="mr-2 h-5 w-5" />
              Schedule a Demo
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            No credit card required. Cancel anytime. Full support included.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">DearMP</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Modern casework management for UK parliamentary offices.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><a href="#demos" className="hover:text-foreground">Demo</a></li>
                <li><a href="#" className="hover:text-foreground">Documentation</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Blog</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
                <li><a href="#" className="hover:text-foreground">Support</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground">GDPR Compliance</a></li>
                <li><a href="#" className="hover:text-foreground">Security</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} DearMP. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                UK GDPR Compliant
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                ISO 27001
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
