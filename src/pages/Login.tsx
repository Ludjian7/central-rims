import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../lib/api.ts';

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", { username, password });
      if (response.data.status === "success") {
        const { token, user } = response.data.data;
        login(token, user);
        navigate("/"); 
      } else {
        setError(response.data.message || "Login failed");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Unable to connect to server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f4f1] flex items-center justify-center p-4">
      <div className="flex flex-col md:flex-row gap-6 max-w-4xl w-full">
        {/* Left Side: Login Form */}
        <Card className="flex-1 shadow-2xl border-none rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="pt-10 pb-2">
            <CardTitle className="text-2xl font-black text-center text-slate-800 tracking-wider">
              LOG IN
            </CardTitle>
            <div className="w-8 h-1 bg-v1-gradient mx-auto mt-1 rounded-full"></div>
          </CardHeader>
          <CardContent className="px-10 pb-8">
            <form onSubmit={handleLogin} className="space-y-6 mt-6">
              {error && (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100 text-center">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="relative group">
                    <Input
                      id="username"
                      type="text"
                      placeholder="Username *"
                      className="h-12 px-4 rounded-xl border-slate-200 focus:border-v1-green focus:ring-v1-green transition-all"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="relative group">
                    <Input
                      id="password"
                      type="password"
                      placeholder="Password *"
                      className="h-12 px-4 rounded-xl border-slate-200 focus:border-v1-green focus:ring-v1-green transition-all"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-v1-gradient hover:opacity-90 text-white font-bold text-lg rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "LOG IN"
                )}
              </Button>

              <div className="text-center pt-2 space-y-2">
                <p className="text-[10px] font-medium text-slate-400">@Central_Computer</p>
                <p className="text-[10px] text-slate-400">
                  Forgot password? <span className="text-v1-green cursor-pointer hover:underline font-bold">Reset here</span>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right Side: Branding */}
        <Card className="flex-1 shadow-2xl border-none rounded-[2rem] bg-white flex flex-col items-center justify-center p-12 text-center">
          <div className="relative mb-6">
             <img src="/logo.png" alt="Central Computer Logo" className="w-48 h-auto object-contain" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-[#1e4620] tracking-widest uppercase">CENTRAL COMPUTER</h3>
            <div className="w-24 h-[1px] bg-slate-200 mx-auto"></div>
            <p className="text-[10px] font-bold text-[#5c7a5d] tracking-[0.2em] uppercase">COMPUTER STORE</p>
            <p className="text-[10px] font-black text-[#1e4620] tracking-[0.3em] uppercase">LANGSA</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
