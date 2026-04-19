import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  BarChart3, 
  Calendar, 
  Users, 
  Bot, 
  Shield, 
  ArrowRight,
  CheckCircle2,
  Play,
  Check,
  Building2,
  Rocket,
  Star
} from 'lucide-react';

import { Footer } from '@/components/layout/Footer';

const features = [
  {
    icon: Zap,
    title: "AI-Powered Automation",
    description: "Automate content scheduling, publishing, and optimization with intelligent AI workflows."
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Track performance across all platforms with real-time insights and detailed reports."
  },
  {
    icon: Calendar,
    title: "Content Calendar",
    description: "Plan and schedule content across multiple channels with our visual calendar."
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Work together seamlessly with role-based access and approval workflows."
  },
  {
    icon: Bot,
    title: "Novee AI Assistant",
    description: "Get intelligent content suggestions, writing assistance, and optimization tips."
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level encryption, SSO, and compliance certifications for peace of mind."
  }
];

const stats = [
  { value: "10K+", label: "Active Users" },
  { value: "50M+", label: "Posts Published" },
  { value: "99.9%", label: "Uptime" },
  { value: "24/7", label: "Support" }
];

const plans = [
  {
    name: "Free",
    description: "Perfect for individuals getting started",
    price: "$0",
    period: "forever",
    icon: Rocket,
    features: [
      "Up to 3 connected platforms",
      "100 scheduled posts/month",
      "Basic analytics",
      "1 team member",
      "Novee AI (10 requests/day)"
    ],
    cta: "Get Started Free",
    popular: false
  },
  {
    name: "Pro",
    description: "For growing creators and small teams",
    price: "$29",
    period: "/month",
    icon: Zap,
    features: [
      "Unlimited platforms",
      "Unlimited scheduled posts",
      "Advanced analytics & reports",
      "Up to 5 team members",
      "Novee AI (unlimited)",
      "Custom automation workflows",
      "Priority support"
    ],
    cta: "Start Free Trial",
    popular: true
  },
  {
    name: "Enterprise",
    description: "For large teams and organizations",
    price: "$99",
    period: "/month",
    icon: Building2,
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "SSO & advanced security",
      "Custom integrations",
      "Dedicated account manager",
      "24/7 phone support",
      "SLA guarantee"
    ],
    cta: "Contact Sales",
    popular: false
  }
];

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Content Director",
    company: "TechFlow Inc.",
    quote: "Novee has transformed how we manage content. The AI suggestions alone have saved us 10+ hours per week.",
    avatar: "SC"
  },
  {
    name: "Marcus Johnson",
    role: "Social Media Manager",
    company: "Bloom Agency",
    quote: "The automation workflows are incredible. We've doubled our output without adding headcount.",
    avatar: "MJ"
  },
  {
    name: "Emily Rodriguez",
    role: "Marketing Lead",
    company: "StartupXYZ",
    quote: "Finally, a CMS that actually understands modern content needs. The analytics are game-changing.",
    avatar: "ER"
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">CH</span>
            </div>
            <span className="font-bold text-xl text-foreground">Content Hub</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">
              Testimonials
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth?tab=signin">Login</Link>
            </Button>
            <Button asChild>
              <Link to="/auth?tab=signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">AI-Powered Content Management</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            The All-in-One CMS for{' '}
            <span className="text-primary">Modern Creators</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Manage, schedule, and optimize your content across all platforms with AI-powered 
            automation and real-time analytics.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link to="/auth?tab=signup">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/auth?tab=signin">
                <Play className="mr-2 h-4 w-4" />
                Login
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-border bg-card/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From content creation to analytics, Content Hub provides all the tools you need to 
              grow your audience and streamline your workflow.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your needs. Start free, upgrade as you grow.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.name} 
                className={`relative flex flex-col ${
                  plan.popular 
                    ? 'border-primary shadow-lg shadow-primary/10 scale-105' 
                    : 'border-border'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <plan.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    asChild
                  >
                    <Link to="/auth?tab=signup">{plan.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/pricing" className="text-primary hover:underline text-sm">
              View full pricing details and FAQ →
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Loved by Content Creators
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See what our users have to say about transforming their content workflow.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name} className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-foreground mb-6 italic">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">{testimonial.avatar}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}, {testimonial.company}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5 border-y border-primary/20">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Transform Your Content Strategy?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of creators and businesses who trust Content Hub to manage their content.
            Start your free trial today — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/auth?tab=signup">
                Get Started for Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth?tab=signin">Login</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              14-day free trial
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Cancel anytime
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

    </div>
  );
}
