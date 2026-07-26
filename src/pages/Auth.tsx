import { useState } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { ModeToggle } from "../components/mode-toggle"
import { useAuth } from "../lib/auth-context"
import { api } from "../lib/api-client"
import {
  Wallet, ArrowRight, Eye, EyeOff,
  CheckCircle, AlertCircle, Loader2,
} from "lucide-react"

function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
      <rect width="36" height="36" rx="8" className="fill-foreground" />
      <path d="M10 22c0-4 3-7 8-7s8 3 8 7" className="stroke-background" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M12 14c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5" className="stroke-background" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
      <circle cx="18" cy="25" r="2" className="fill-background" />
      <path d="M24 25l2 2 4-4" className="stroke-background" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { login, register, signInWithCode, isAuthenticated } = useAuth()
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "signincode">("login")
  const [resetStep, setResetStep] = useState<"email" | "code" | "success">("email")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [resetCode, setResetCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [signinCodeStep, setSigninCodeStep] = useState<"email" | "code">("email")
  const [signinCode, setSigninCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [walletConnecting, setWalletConnecting] = useState(false)

  if (isAuthenticated) {
    navigate("/app")
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (mode === "forgot") {
      if (resetStep === "email") {
        if (!email) { setError("Please enter your email"); return }
        setIsSubmitting(true)
        try {
          await api.auth.forgotPassword(email)
          setResetStep("code")
          setError("")
        } catch (err: any) {
          setError(err.message || "Failed to send reset code")
        } finally {
          setIsSubmitting(false)
        }
        return
      }
      if (resetStep === "code") {
        if (!resetCode || !newPassword) { setError("Please enter the code and a new password"); return }
        if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return }
        setIsSubmitting(true)
        try {
          await api.auth.resetPassword(email, resetCode, newPassword)
          setResetStep("success")
          setError("")
        } catch (err: any) {
          setError(err.message || "Failed to reset password")
        } finally {
          setIsSubmitting(false)
        }
        return
      }
      return
    }

    if (mode === "signincode") {
      if (signinCodeStep === "email") {
        if (!email) { setError("Please enter your email"); return }
        setIsSubmitting(true)
        try {
          await api.auth.sendSignInCode(email)
          setSigninCodeStep("code")
          setError("")
        } catch (err: any) {
          setError(err.message || "Failed to send sign-in code")
        } finally {
          setIsSubmitting(false)
        }
        return
      }
      if (signinCodeStep === "code") {
        if (!signinCode) { setError("Please enter the code"); return }
        setIsSubmitting(true)
        try {
          await signInWithCode(email, signinCode)
          navigate("/app")
        } catch (err: any) {
          setError(err.message || "Invalid code")
        } finally {
          setIsSubmitting(false)
        }
        return
      }
      return
    }

    if (!email || !password) { setError("Please fill in all fields"); return }
    if (mode === "register" && password.length < 6) { setError("Password must be at least 6 characters"); return }
    setIsSubmitting(true)
    try {
      if (mode === "login") await login(email, password)
      else await register(email, password, displayName || undefined)
      navigate("/app")
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWalletConnect = async () => {
    setWalletConnecting(true)
    setError("")
    try {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" })
        if (accounts?.[0]) {
          await login(`wallet-${accounts[0].slice(0, 8)}@settleflow.io`, "wallet-auth-" + accounts[0])
          navigate("/app")
        }
      } else {
        setError("No wallet detected. Please install MetaMask or an Arc wallet extension.")
        setWalletConnecting(false)
        return
      }
    } catch (err: any) {
      setError(err.message || "Wallet connection failed")
    } finally {
      setWalletConnecting(false)
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
              <Logo /><span className="font-semibold text-lg tracking-tight">SettleFlow</span>
            </button>
            <div className="flex items-center gap-3"><ModeToggle /></div>
          </div>
        </div>
      </nav>

      <section className="relative pt-20 pb-12 min-h-screen flex items-center">
        <div className="max-w-md mx-auto px-4 sm:px-6 w-full pt-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card>
              <CardContent className="p-0">
                <div className="p-6 sm:p-8">
                  <div className="text-center mb-6">
                    <div className="flex justify-center mb-4"><Logo size={40} /></div>
                    <h1 className="text-2xl font-bold tracking-tight mb-1">
                      {mode === "forgot" ? "Reset Password" : mode === "signincode" ? "Email Sign-In" : mode === "login" ? "Welcome Back" : "Get Started"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {mode === "forgot" ? "We'll send a reset code to your email" : mode === "signincode" ? "We'll send a code to your email" : mode === "login" ? "Sign in to manage your payments" : "Create an account to automate USDC settlements"}
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                    </div>
                  )}

                  {mode !== "forgot" && mode !== "signincode" && (
                    <>
                      <div className="space-y-3 mb-6">
                        <button onClick={handleWalletConnect} disabled={walletConnecting}
                          className="w-full flex items-center justify-center gap-3 p-3 rounded-xl border-2 border-border hover:border-foreground/30 bg-muted/30 hover:bg-muted transition-all disabled:opacity-50">
                          {walletConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                          <span className="font-medium text-sm">{walletConnecting ? "Connecting..." : "Connect Wallet"}</span>
                          {!walletConnecting && <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />}
                        </button>
                      </div>

                      <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or continue with email</span></div>
                      </div>
                    </>
                  )}

                  {mode === "forgot" ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {resetStep === "email" && (
                        <>
                          <div className="text-center mb-2">
                            <p className="text-sm text-muted-foreground">Enter your email to request a password reset code.</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">Email</label>
                            <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                          </div>
                          <Button type="submit" className="w-full h-11 font-semibold" disabled={isSubmitting}>
                            Send Reset Code
                          </Button>
                        </>
                      )}
                      {resetStep === "code" && (
                        <>
                          <div className="text-center mb-2">
                            <p className="text-sm text-muted-foreground">A reset code was sent to <strong>{email}</strong>. Enter it below along with your new password.</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">Reset Code</label>
                            <Input type="text" placeholder="000000" value={resetCode} onChange={(e) => setResetCode(e.target.value)} required maxLength={6} className="text-center text-lg tracking-widest font-mono" />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">New Password</label>
                            <div className="relative">
                              <Input type={showNewPassword ? "text" : "password"} placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-10" required minLength={6} />
                              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <Button type="submit" className="w-full h-11 font-semibold" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Reset Password
                          </Button>
                        </>
                      )}

                      {resetStep === "success" && (
                        <div className="text-center space-y-4">
                          <div className="flex justify-center">
                            <CheckCircle className="w-12 h-12 text-green-500" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">Password Reset Successfully</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Your password has been updated. You can now sign in with your new password.
                            </p>
                          </div>
                          <Button onClick={() => { setMode("login"); setResetStep("email"); setError(""); setResetCode(""); setNewPassword(""); }}
                            className="w-full h-11 font-semibold">
                            Back to Sign In
                          </Button>
                        </div>
                      )}

                      {resetStep !== "success" && (
                        <div className="mt-2 text-center">
                          <button type="button" onClick={() => { setMode("login"); setResetStep("email"); setError(""); setResetCode(""); setNewPassword(""); }}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Back to Sign In
                          </button>
                        </div>
                      )}
                    </form>
                  ) : mode === "signincode" ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {signinCodeStep === "email" && (
                        <>
                          <div className="text-center mb-2">
                            <p className="text-sm text-muted-foreground">Enter your email and we'll send you a sign-in code.</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">Email</label>
                            <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                          </div>
                          <Button type="submit" className="w-full h-11 font-semibold" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Send Sign-In Code
                          </Button>
                        </>
                      )}
                      {signinCodeStep === "code" && (
                        <>
                          <div className="text-center mb-2">
                            <p className="text-sm text-muted-foreground">A sign-in code was sent to <strong>{email}</strong>. Enter it below to sign in.</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">Sign-In Code</label>
                            <Input type="text" placeholder="000000" value={signinCode} onChange={(e) => setSigninCode(e.target.value)} required maxLength={6} className="text-center text-lg tracking-widest font-mono" />
                          </div>
                          <Button type="submit" className="w-full h-11 font-semibold" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Sign In
                          </Button>
                        </>
                      )}
                      <div className="mt-2 text-center">
                        <button type="button" onClick={() => { setMode("login"); setSigninCodeStep("email"); setSigninCode(""); setError(""); }}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                          Back to Sign In
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {mode === "register" && (
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Display Name</label>
                          <Input type="text" placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Email</label>
                        <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Password</label>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" required />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {mode === "login" && (
                          <div className="mt-2 flex items-center justify-between">
                            <button type="button" onClick={() => { setMode("signincode"); setSigninCodeStep("email"); setSigninCode(""); setError(""); }}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                              Sign in with email code
                            </button>
                            <button type="button" onClick={() => { setMode("forgot"); setResetStep("email"); setError(""); setResetCode(""); setNewPassword(""); }}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                              Forgot password?
                            </button>
                          </div>
                        )}
                      </div>
                      <Button type="submit" className="w-full h-11 font-semibold" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {mode === "login" ? "Sign In" : "Create Account"}
                      </Button>
                    </form>
                  )}

                  {mode !== "forgot" && mode !== "signincode" && (
                    <div className="mt-4 text-center">
                      <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                      </button>
                    </div>
                  )}

                  {mode !== "forgot" && mode !== "signincode" && (
                    <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">End-to-end encrypted.</span> Your credentials and data are securely stored and never shared with third parties.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-border/50 p-4 bg-muted/20">
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">Home</button>
                    <span>&middot;</span>
                    <a href="https://github.com/worztm/settleflow" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
