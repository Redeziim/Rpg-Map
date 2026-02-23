"use client";

import { useState, useCallback, useTransition } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Loader2,
  Check,
  X,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "login" | "register";

interface FieldError {
  email?: string;
  password?: string;
  name?: string;
  confirmPassword?: string;
}

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function strengthLabel(score: number) {
  if (score === 0) return "Muito fraca";
  if (score === 1) return "Fraca";
  if (score === 2) return "Razoavel";
  if (score === 3) return "Boa";
  return "Forte";
}

function strengthColor(score: number) {
  if (score <= 1) return "bg-destructive";
  if (score === 2) return "bg-yellow-500";
  if (score === 3) return "bg-accent";
  return "bg-green-500";
}

function PasswordRules({ password }: { password: string }) {
  const rules = [
    { label: "Minimo 8 caracteres", valid: password.length >= 8 },
    { label: "Pelo menos 1 numero", valid: /[0-9]/.test(password) },
    { label: "Pelo menos 1 letra maiuscula", valid: /[A-Z]/.test(password) },
  ];

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      {rules.map((rule) => (
        <div key={rule.label} className="flex items-center gap-2 text-xs">
          {rule.valid ? (
            <Check className="h-3 w-3 text-green-500 shrink-0" />
          ) : (
            <X className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <span
            className={cn(
              rule.valid ? "text-green-500" : "text-muted-foreground"
            )}
          >
            {rule.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function InputField({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  showToggle,
  onToggle,
  toggleState,
  id,
}: {
  icon: React.ElementType;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  showToggle?: boolean;
  onToggle?: () => void;
  toggleState?: boolean;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors duration-200",
          "bg-secondary/50 focus-within:border-primary focus-within:bg-secondary/80",
          error ? "border-destructive" : "border-border"
        )}
      >
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          id={id}
          type={showToggle ? (toggleState ? "text" : "password") : type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          autoComplete={type === "password" ? "current-password" : undefined}
        />
        {showToggle && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={toggleState ? "Ocultar senha" : "Mostrar senha"}
          >
            {toggleState ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive pl-1">{error}</p>}
    </div>
  );
}

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "fixed top-6 right-6 z-50 flex items-center gap-3 rounded-lg border px-5 py-3.5 shadow-lg",
        "animate-fade-in-up backdrop-blur-sm",
        type === "success"
          ? "border-green-500/30 bg-green-500/10 text-green-400"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {type === "success" ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <X className="h-4 w-4 shrink-0" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AuthForm() {
  const [activeTab, setActiveTab] = useState<Tab>("login");
  const [isPending, startTransition] = useTransition();

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShowPw, setLoginShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginErrors, setLoginErrors] = useState<FieldError>({});

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regShowPw, setRegShowPw] = useState(false);
  const [regShowConfirm, setRegShowConfirm] = useState(false);
  const [regErrors, setRegErrors] = useState<FieldError>({});

  // Toast
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  const validateLogin = useCallback(() => {
    const errors: FieldError = {};
    if (!loginEmail) errors.email = "Email obrigatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail))
      errors.email = "Email invalido";
    if (!loginPassword) errors.password = "Senha obrigatoria";
    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  }, [loginEmail, loginPassword]);

  const validateRegister = useCallback(() => {
    const errors: FieldError = {};
    if (!regName.trim()) errors.name = "Nome obrigatorio";
    if (!regEmail) errors.email = "Email obrigatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail))
      errors.email = "Email invalido";
    if (!regPassword) errors.password = "Senha obrigatoria";
    else if (regPassword.length < 8)
      errors.password = "Senha deve ter no minimo 8 caracteres";
    else if (!/[A-Z]/.test(regPassword))
      errors.password = "Senha deve ter pelo menos 1 letra maiuscula";
    else if (!/[0-9]/.test(regPassword))
      errors.password = "Senha deve ter pelo menos 1 numero";
    if (!regConfirm) errors.confirmPassword = "Confirme sua senha";
    else if (regConfirm !== regPassword)
      errors.confirmPassword = "As senhas nao coincidem";
    setRegErrors(errors);
    return Object.keys(errors).length === 0;
  }, [regName, regEmail, regPassword, regConfirm]);

  const handleLogin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateLogin()) return;
      startTransition(() => {
        // Mock authentication delay
        setTimeout(() => {
          showToast("Login realizado com sucesso!", "success");
        }, 1500);
      });
    },
    [validateLogin, showToast]
  );

  const handleRegister = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateRegister()) return;
      startTransition(() => {
        setTimeout(() => {
          showToast("Conta criada com sucesso!", "success");
          setActiveTab("login");
          setLoginEmail(regEmail);
          setRegName("");
          setRegEmail("");
          setRegPassword("");
          setRegConfirm("");
          setRegErrors({});
        }, 1500);
      });
    },
    [validateRegister, showToast, regEmail]
  );

  const switchTab = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      setLoginErrors({});
      setRegErrors({});
    },
    []
  );

  const strength = getPasswordStrength(regPassword);

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="w-full max-w-md mx-auto">
        {/* Logo / Branding */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10 border border-primary/20">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight text-balance">
              RPG Asset Platform
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "login"
                ? "Entre na sua conta para continuar"
                : "Crie sua conta para comecar"}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xl shadow-black/20">
          {/* Tabs */}
          <div className="flex rounded-lg bg-secondary/60 p-1 mb-6">
            <button
              onClick={() => switchTab("login")}
              className={cn(
                "flex-1 rounded-md py-2.5 text-sm font-medium transition-all duration-300",
                activeTab === "login"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Entrar
            </button>
            <button
              onClick={() => switchTab("register")}
              className={cn(
                "flex-1 rounded-md py-2.5 text-sm font-medium transition-all duration-300",
                activeTab === "register"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Criar Conta
            </button>
          </div>

          {/* Login Form */}
          <div
            className={cn(
              "transition-all duration-300",
              activeTab === "login"
                ? "opacity-100 translate-y-0 block"
                : "opacity-0 translate-y-2 hidden"
            )}
          >
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <InputField
                id="login-email"
                icon={Mail}
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(v) => {
                  setLoginEmail(v);
                  if (loginErrors.email) setLoginErrors((e) => ({ ...e, email: undefined }));
                }}
                error={loginErrors.email}
              />
              <InputField
                id="login-password"
                icon={Lock}
                type="password"
                placeholder="Senha"
                value={loginPassword}
                onChange={(v) => {
                  setLoginPassword(v);
                  if (loginErrors.password) setLoginErrors((e) => ({ ...e, password: undefined }));
                }}
                error={loginErrors.password}
                showToggle
                onToggle={() => setLoginShowPw(!loginShowPw)}
                toggleState={loginShowPw}
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                      rememberMe
                        ? "bg-primary border-primary"
                        : "border-border group-hover:border-muted-foreground"
                    )}
                    onClick={() => setRememberMe(!rememberMe)}
                    role="checkbox"
                    aria-checked={rememberMe}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") setRememberMe(!rememberMe);
                    }}
                  >
                    {rememberMe && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span
                    className="text-xs text-muted-foreground group-hover:text-foreground transition-colors select-none"
                    onClick={() => setRememberMe(!rememberMe)}
                  >
                    Lembrar-me
                  </span>
                </label>
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all duration-200",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  !isPending && "active:scale-[0.98]"
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground mt-1">
                {"Nao tem uma conta? "}
                <button
                  type="button"
                  onClick={() => switchTab("register")}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Criar nova conta
                </button>
              </p>
            </form>
          </div>

          {/* Register Form */}
          <div
            className={cn(
              "transition-all duration-300",
              activeTab === "register"
                ? "opacity-100 translate-y-0 block"
                : "opacity-0 translate-y-2 hidden"
            )}
          >
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <InputField
                id="reg-name"
                icon={User}
                placeholder="Nome completo"
                value={regName}
                onChange={(v) => {
                  setRegName(v);
                  if (regErrors.name) setRegErrors((e) => ({ ...e, name: undefined }));
                }}
                error={regErrors.name}
              />
              <InputField
                id="reg-email"
                icon={Mail}
                type="email"
                placeholder="Email"
                value={regEmail}
                onChange={(v) => {
                  setRegEmail(v);
                  if (regErrors.email) setRegErrors((e) => ({ ...e, email: undefined }));
                }}
                error={regErrors.email}
              />
              <div className="flex flex-col gap-1.5">
                <InputField
                  id="reg-password"
                  icon={Lock}
                  type="password"
                  placeholder="Senha"
                  value={regPassword}
                  onChange={(v) => {
                    setRegPassword(v);
                    if (regErrors.password) setRegErrors((e) => ({ ...e, password: undefined }));
                  }}
                  error={regErrors.password}
                  showToggle
                  onToggle={() => setRegShowPw(!regShowPw)}
                  toggleState={regShowPw}
                />
                {regPassword.length > 0 && (
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            strengthColor(strength)
                          )}
                          style={{ width: `${(strength / 4) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {strengthLabel(strength)}
                      </span>
                    </div>
                    <PasswordRules password={regPassword} />
                  </div>
                )}
              </div>
              <InputField
                id="reg-confirm"
                icon={Lock}
                type="password"
                placeholder="Confirmar senha"
                value={regConfirm}
                onChange={(v) => {
                  setRegConfirm(v);
                  if (regErrors.confirmPassword) setRegErrors((e) => ({ ...e, confirmPassword: undefined }));
                }}
                error={regErrors.confirmPassword}
                showToggle
                onToggle={() => setRegShowConfirm(!regShowConfirm)}
                toggleState={regShowConfirm}
              />

              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all duration-200",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  !isPending && "active:scale-[0.98]"
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  "Criar Conta"
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground mt-1">
                {"Ja tem uma conta? "}
                <button
                  type="button"
                  onClick={() => switchTab("login")}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Fazer login
                </button>
              </p>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao continuar, voce concorda com os Termos de Servico e Politica de Privacidade.
        </p>
      </div>
    </>
  );
}
