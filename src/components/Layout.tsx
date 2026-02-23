import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Images, 
  ImagePlus, 
  Settings, 
  Menu, 
  X,
  Users,
  User,
  LogOut,
  CreditCard,
  MousePointerClick,
  Send
} from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Galerias', href: '/galleries/select', icon: Images, matchPrefix: '/galleries' },
  { name: 'Clientes', href: '/clients', icon: Users },
  { name: 'Nova Galeria', href: '__popover__', icon: ImagePlus },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuthContext();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link to="/">
              <Logo size="md" />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;

              // Popover for "Nova Galeria"
              if (item.href === '__popover__') {
                return (
                  <Popover key={item.name}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-2" align="center" sideOffset={8}>
                      <div className="space-y-1">
                        <Link
                          to="/gallery/new"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors"
                        >
                          <MousePointerClick className="h-4 w-4 text-primary" />
                          <div>
                            <p>Seleção</p>
                            <p className="text-xs text-muted-foreground font-normal">Cliente seleciona fotos</p>
                          </div>
                        </Link>
                        <Link
                          to="/deliver/new"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors"
                        >
                          <Send className="h-4 w-4 text-primary" />
                          <div>
                          <p>Transfer</p>
                            <p className="text-xs text-muted-foreground font-normal">Entrega final</p>
                          </div>
                        </Link>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }

              const isActive = (item as any).matchPrefix
                ? location.pathname.startsWith((item as any).matchPrefix)
                : location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {user?.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.user_metadata?.full_name || user?.user_metadata?.name || 'Usuário'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Minha Conta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/credits" className="cursor-pointer">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Planos e Créditos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border animate-slide-up">
            <nav className="container py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;

                // Popover for "Nova Galeria" on mobile
                if (item.href === '__popover__') {
                  return (
                    <div key={item.name} className="space-y-1">
                      <Link
                        to="/gallery/new"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <MousePointerClick className="h-5 w-5" />
                        Nova Seleção
                      </Link>
                      <Link
                        to="/deliver/new"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Send className="h-5 w-5" />
                        Nova Transfer
                      </Link>
                    </div>
                  );
                }

                const isActive = (item as any).matchPrefix
                  ? location.pathname.startsWith((item as any).matchPrefix)
                  : location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container py-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
