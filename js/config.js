// Configuração de conexão com o Supabase.
// A "chave publicável" é segura para ficar exposta no site (feita pra isso),
// desde que o Row Level Security (RLS) esteja ativado nas tabelas — já está.
const SUPABASE_URL = "https://qudksysgsranmkzvdknz.supabase.co";
const SUPABASE_KEY = "sb_publishable_3A86DGOcKa7LxaXqDKV0PA_VrEOVUzZ";

// Número de WhatsApp para receber pedidos (formato: código do país + DDD + número, só números)
// Ex: 55 11 99999-9999 -> "5511999999999"
const WHATSAPP_NUMBER = "5511999999999"; // <-- TROQUE pelo número real

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
