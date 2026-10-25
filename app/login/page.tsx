"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useState } from "react";

export default function LoginPage() { const router = useRouter(); const [loading, setLoading] = useState(false); const login = async () => { setLoading(true); await fetch("/api/auth/demo", { method: "POST" }); router.push("/dashboard"); }; return <main className="grid min-h-screen place-items-center bg-canvas px-5"><Card className="w-full max-w-md p-8"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-white"><ShieldCheck size={22} /></span><div><div className="font-bold text-navy">BrandShield AI</div><div className="text-xs text-muted">Protect before publish</div></div></div><h1 className="mt-10 text-2xl font-bold text-navy">Welcome back</h1><p className="mt-2 text-sm leading-6 text-muted">Use the local demo workspace to explore the complete review workflow.</p><Button onClick={login} disabled={loading} className="mt-7 w-full">{loading ? "Opening workspace…" : "Continue in demo mode"}</Button><p className="mt-6 text-center text-sm text-muted">Need an account? <Link className="font-semibold text-royal" href="/signup">Create one</Link></p></Card></main>; }
