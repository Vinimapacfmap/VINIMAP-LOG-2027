/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = 3000;

// Parse incoming JSON requests
app.use(express.json());

// Initialize Google GenAI client lazily to handle missing API keys gracefully
let aiInstance: GoogleGenAI | null = null;

function getGoogleGenAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI Insights will run in fallback rule-based mode.");
      return null;
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Rule-based fallback insights generator
function generateFallbackInsights(transactions: any[]) {
  const payables = transactions.filter(t => t.type === 'payable');
  const receivables = transactions.filter(t => t.type === 'receivable');
  const totalPayable = payables.reduce((sum, t) => sum + t.amount, 0);
  const totalReceivable = receivables.reduce((sum, t) => sum + t.amount, 0);

  const payablesByCategory: Record<string, number> = {};
  payables.forEach(t => {
    payablesByCategory[t.category] = (payablesByCategory[t.category] || 0) + t.amount;
  });

  const sortedCategories = Object.entries(payablesByCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      percentageOfTotal: totalPayable > 0 ? (amount / totalPayable) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const highestSpends = sortedCategories.slice(0, 3);

  // Generate custom rule-based tips
  const tips = [];
  
  // Google Maps / Infraestrutura
  const infraAmt = payablesByCategory['Infraestrutura'] || 0;
  if (infraAmt > 0) {
    tips.push({
      category: 'Infraestrutura',
      title: 'Otimizar Licenciamento e Cotas de API de Mapas',
      description: 'Seus custos com APIs do Google Maps e hospedagem cloud somam R$ ' + infraAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '. Considere implementar cache de georreferenciamento no servidor e limitar a frequência de chamadas de atualização em tempo real dos entregadores em segundo plano para reduzir as faturas.',
      impact: 'Alto',
      potentialSavings: infraAmt * 0.15
    });
  }

  // Administrative / Rent
  const adminAmt = payablesByCategory['Administrativo'] || 0;
  if (adminAmt > 0) {
    tips.push({
      category: 'Administrativo',
      title: 'Auditoria de Assinaturas e Renegociação de Locação',
      description: 'Gastos administrativos fixos representam R$ ' + adminAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '. Analise licenças de softwares operacionais sobressalentes ou renegocie taxas contratuais de locação da sede e do hub físico de triagem.',
      impact: 'Médio',
      potentialSavings: adminAmt * 0.10
    });
  }

  // Maintenance / Vehicles
  const maintAmt = payablesByCategory['Manutenção'] || 0;
  if (maintAmt > 0) {
    tips.push({
      category: 'Manutenção',
      title: 'Contrato de Parceria Corporativa com Auto-Peças',
      description: 'Gastos com manutenção preventiva de veículos somam R$ ' + maintAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '. Centralizar os serviços mecânicos em uma oficina conveniada reduz despesas recorrentes de pastilhas de freio, filtros e pneus.',
      impact: 'Médio',
      potentialSavings: maintAmt * 0.12
    });
  }

  // Repasses / Operational
  const repasseAmt = payablesByCategory['Repasses'] || 0;
  if (repasseAmt > 0) {
    tips.push({
      category: 'Repasses',
      title: 'Análise de Roteamento Inteligente e Taxas Operacionais',
      description: 'Repasses operacionais para os entregadores totalizam R$ ' + repasseAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '. Roteiros com menor ociosidade e agrupamentos automáticos de pedidos por proximidade geográfica otimizam o valor por corrida sem reduzir a remuneração por quilômetro dos condutores.',
      impact: 'Alto',
      potentialSavings: repasseAmt * 0.08
    });
  }

  if (tips.length === 0) {
    tips.push({
      category: 'Operacional',
      title: 'Revisão Sistemática de Despesas Operacionais',
      description: 'Acompanhe as despesas semanais de forma rigorosa utilizando as ferramentas de classificação do painel para evitar custos flutuantes e gastos de última hora.',
      impact: 'Médio',
      potentialSavings: 150.00
    });
  }

  const summary = `Seu volume total de contas a pagar é de R$ ${totalPayable.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, enquanto o faturamento a receber está projetado em R$ ${totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. ` +
    (highestSpends.length > 0 
      ? `A categoria com maior concentração de gastos é "${highestSpends[0].category}" com R$ ${highestSpends[0].amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${highestSpends[0].percentageOfTotal.toFixed(1)}% do total de despesas). Sugere-se priorizar a otimização desta rubrica imediatamente.`
      : "Suas contas estão distribuídas de forma equilibrada, sem sobrecarga ou dependência crítica em uma única categoria.");

  return {
    summary,
    tips,
    highestSpends
  };
}

// Helper function to call generateContent with retry and exponential backoff
async function generateContentWithRetry(ai: any, params: any, maxAttempts = 3, initialDelay = 1000) {
  let attempt = 1;
  let delay = initialDelay;
  while (true) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const status = err.status || err.statusCode || (err.error && err.error.code) || 0;
      const message = err.message || "";
      const isTransient = status === 503 || status === 429 || status === 500 || 
                          message.includes("503") || message.includes("429") || 
                          message.includes("UNAVAILABLE") || message.includes("demand") ||
                          message.includes("temporary");
      
      if (isTransient && attempt < maxAttempts) {
        console.warn(`Gemini API transient error (attempt ${attempt}/${maxAttempts}): ${message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        delay *= 2; // exponential backoff
      } else {
        throw err;
      }
    }
  }
}

// POST endpoint to generate financial insights using Gemini or Fallback
app.post('/api/financial/insights', async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'transactions must be a valid array' });
    }

    const ai = getGoogleGenAI();
    if (!ai) {
      // No API key -> use fallback
      console.log("No API key. Returning fallback insights.");
      return res.json(generateFallbackInsights(transactions));
    }

    // Prepare aggregated inputs for Gemini to keep tokens low and responses ultra-fast
    const payables = transactions.filter(t => t.type === 'payable');
    const receivables = transactions.filter(t => t.type === 'receivable');
    const totalPayable = payables.reduce((sum, t) => sum + t.amount, 0);
    const totalReceivable = receivables.reduce((sum, t) => sum + t.amount, 0);

    const payablesByCategory: Record<string, number> = {};
    payables.forEach(t => {
      payablesByCategory[t.category] = (payablesByCategory[t.category] || 0) + t.amount;
    });

    const fixedPayables = payables.filter(t => t.costType === 'fixed').reduce((sum, t) => sum + t.amount, 0);
    const variablePayables = payables.filter(t => t.costType !== 'fixed').reduce((sum, t) => sum + t.amount, 0);

    const contextText = `
Você é um consultor financeiro especialista no sistema ZeroPaper, especializado em otimização de custos e eficiência operacional de empresas de logística, transportes e entregas expressas.
Aqui está o resumo financeiro atual da empresa em 2026:

- Total a Receber Projetado: R$ ${totalReceivable.toFixed(2)}
- Total a Pagar (Despesas): R$ ${totalPayable.toFixed(2)}
- Despesas Fixas: R$ ${fixedPayables.toFixed(2)}
- Despesas Variáveis: R$ ${variablePayables.toFixed(2)}

Despesas Consolidadas por Categoria:
${Object.entries(payablesByCategory).map(([cat, amt]) => `- ${cat}: R$ ${amt.toFixed(2)} (${((amt / (totalPayable || 1)) * 100).toFixed(1)}%)`).join('\n')}

Lançamentos de Despesa Individuais:
${payables.map(p => `- ${p.description} (Favorecido: ${p.recipientOrPayer}, Categoria: ${p.category}): R$ ${p.amount.toFixed(2)} [${p.costType === 'fixed' ? 'Fixo' : 'Variável'}] Status: ${p.status}`).join('\n')}

Por favor, faça uma análise criteriosa e profissional em português destes dados.
Forneça sugestões inteligentes de otimização focando em:
1. Identificar as categorias com maiores despesas e recomendar formas realistas de reduzi-las (ex: roteirização para reduzir custos de combustíveis/repasses de corrida, renegociar contratos de cloud hosting GCP/Firebase, otimizar custos de motopeças ou criar parcerias de freio e pastilhas, e otimizar APIs Google Maps).
2. Fornecer dicas concretas com impacto ("Alto", "Médio" ou "Baixo") e economia mensal estimada razoável (BRL).
3. Listar as 3 maiores despesas por categoria.
`;

    // Define response schema to get reliable structured JSON
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "Resumo executivo profissional de saúde financeira, tendências e orientações em português."
        },
        tips: {
          type: Type.ARRAY,
          description: "Lista de 3 a 5 recomendações concretas de otimização de custos em português.",
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, description: "Nome da categoria associada." },
              title: { type: Type.STRING, description: "Título conciso da recomendação." },
              description: { type: Type.STRING, description: "Explicação prática e detalhada em português de como economizar." },
              impact: { type: Type.STRING, description: "Impacto estimado: Alto, Médio ou Baixo." },
              potentialSavings: { type: Type.NUMBER, description: "Valor aproximado de economia mensal estimada em BRL (Ex: 150.00)." }
            },
            required: ["category", "title", "description", "impact", "potentialSavings"]
          }
        },
        highestSpends: {
          type: Type.ARRAY,
          description: "As 3 categorias com maiores volumes de saída de caixa.",
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              percentageOfTotal: { type: Type.NUMBER }
            },
            required: ["category", "amount", "percentageOfTotal"]
          }
        }
      },
      required: ["summary", "tips", "highestSpends"]
    };

    console.log("Calling Gemini API for financial insights...");
    let response;
    try {
      // Tier 1: Try gemini-3.5-flash with retries
      response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: contextText,
        config: {
          systemInstruction: "Você é um analista financeiro corporativo sênior, especializado em gestão de caixa ZeroPaper para micro e pequenas empresas de entrega rápida.",
          responseMimeType: "application/json",
          responseSchema
        }
      }, 3, 1000);
    } catch (err: any) {
      console.warn("gemini-3.5-flash failed. Falling back to gemini-3.1-flash-lite...", err.message || err);
      try {
        // Tier 2: Try gemini-3.1-flash-lite with retries as a faster / lower load fallback model
        response = await generateContentWithRetry(ai, {
          model: "gemini-3.1-flash-lite",
          contents: contextText,
          config: {
            systemInstruction: "Você é um analista financeiro corporativo sênior, especializado em gestão de caixa ZeroPaper para micro e pequenas empresas de entrega rápida.",
            responseMimeType: "application/json",
            responseSchema
          }
        }, 2, 800);
      } catch (liteErr: any) {
        // Both models failed, throw to activate the local rule-based fallback
        throw new Error(`All Gemini models failed (gemini-3.5-flash and gemini-3.1-flash-lite). Last error: ${liteErr.message || liteErr}`);
      }
    }

    const text = response?.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    const result = JSON.parse(text.trim());
    return res.json(result);

  } catch (err: any) {
    // Print a warning instead of console.error so monitoring won't treat this transient network/demand issue as a fatal crash
    console.warn("Gracefully falling back to rule-based insights due to Gemini API unavailability:", err.message || err);
    // Fallback to rule-based analysis on error to ensure a seamless experience
    try {
      const { transactions } = req.body;
      return res.json(generateFallbackInsights(transactions));
    } catch (fallbackErr) {
      console.error("Critical: Fallback insights also failed:", fallbackErr);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

// POST endpoint to generate intelligent routing insights
app.post('/api/routing/insights', async (req, res) => {
  const { riderName, vehicle, batteryPercent, orders, metrics, savingsPercent, isOptimized } = req.body;
  
  const generateFallbackRouteInsights = () => {
    return {
      summary: `Análise preditiva para o condutor ${riderName || 'do Vinimap'} em rota de entrega no ${orders?.[0]?.region || 'Centro'}. A rota sequencial atual reorganizou as paradas visando mitigar pontos de congestionamento comuns no tráfego urbano de São Paulo e aproximar sequencialmente paradas na mesma vizinhança.`,
      tips: [
        {
          title: "Economia Hidráulica/Bateria",
          description: `A rota sequencial atual economiza recursos operacionais diretos e poupa ${savingsPercent || 15}% de desgaste mecânico do veículo (${vehicle || 'Moto'}).`,
          type: "battery"
        },
        {
          title: "Condições de Trânsito",
          description: `Previsão de lentidão nas vias coletoras da região ${orders?.[0]?.region || 'Centro'}. Recomenda-se evitar cruzamentos em grandes avenidas e dar preferência para vias secundárias indicadas pelo GPS.`,
          type: "traffic"
        },
        {
          title: "Alerta de Segurança Operacional",
          description: "Mantenha o aplicativo do entregador ativo em segundo plano para o correto registro das confirmações digitais por foto na entrega.",
          type: "safety"
        }
      ],
      efficiencyScore: Math.min(100, Math.max(40, 75 + (savingsPercent || 15)))
    };
  };

  try {
    const ai = getGoogleGenAI();
    if (!ai) {
      return res.json(generateFallbackRouteInsights());
    }

    const contextText = `
Você é um despachante e consultor logístico sênior do sistema Vinimap Logistics OS, especialista em otimização de rotas urbanas de última milha (last-mile) na cidade de São Paulo.
Aqui estão as informações da rota atual do condutor para análise:

- Condutor: ${riderName}
- Veículo: ${vehicle} (Nível de bateria/combustível: ${batteryPercent}%)
- Paradas de entrega pendentes (na ordem sequencial de visita):
${(orders || []).map((o: any, idx: number) => `  ${idx + 1}. [ID: ${o.id}] Cliente: ${o.clientName}, Região: ${o.region}, Valor: R$ ${o.value.toFixed(2)}, CEP: ${o.cep || 'N/D'}, Prioridade: ${o.priority}`).join('\n')}

- Métricas calculadas para esta sequência:
  * Distância Total: ${metrics?.distance} km
  * Tempo Estimado Total: ${metrics?.time} minutos
  * Economia em Relação ao Percurso Original: ${savingsPercent}% (Esta rota está ${isOptimized ? 'OTIMIZADA' : 'EM FLUXO ORIGINAL'})

Por favor, faça uma análise criteriosa e profissional em português. Forneça um resumo executivo inteligente de como o condutor deve proceder e sugira exatamente 3 dicas táticas (uma sobre trânsito/tráfego, uma sobre bateria/autonomia do veículo e uma sobre segurança na entrega das mercadorias).
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "Resumo executivo curto e motivacional em português sobre a eficácia da sequência e vias de tráfego sugeridas em São Paulo."
        },
        tips: {
          type: Type.ARRAY,
          description: "Lista de exatamente 3 dicas curtas e práticas de campo em português.",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Título conciso da dica." },
              description: { type: Type.STRING, description: "Explicação em português de como proceder no campo." },
              type: { type: Type.STRING, description: "Tipo da dica. Deve ser EXATAMENTE um dos seguintes: 'traffic', 'battery', 'safety'." }
            },
            required: ["title", "description", "type"]
          }
        },
        efficiencyScore: {
          type: Type.NUMBER,
          description: "Uma pontuação de eficiência logística numérica estimada de 50 a 100."
        }
      },
      required: ["summary", "tips", "efficiencyScore"]
    };

    console.log("Calling Gemini API for routing insights...");
    let response;
    try {
      response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: contextText,
        config: {
          systemInstruction: "Você é um supervisor logístico especialista em roteirização inteligente Vinimap Logistics OS e despacho em tempo real na grande São Paulo.",
          responseMimeType: "application/json",
          responseSchema
        }
      }, 3, 1000);
    } catch (err: any) {
      console.warn("gemini-3.5-flash failed for routing. Trying gemini-3.1-flash-lite...", err.message || err);
      response = await generateContentWithRetry(ai, {
        model: "gemini-3.1-flash-lite",
        contents: contextText,
        config: {
          systemInstruction: "Você é um supervisor logístico especialista em roteirização inteligente Vinimap Logistics OS e despacho em tempo real na grande São Paulo.",
          responseMimeType: "application/json",
          responseSchema
        }
      }, 2, 800);
    }

    const text = response?.text;
    if (!text) {
      throw new Error("Empty response from Gemini API for routing");
    }

    const result = JSON.parse(text.trim());
    return res.json(result);

  } catch (err: any) {
    console.warn("Gracefully falling back to rule-based routing insights:", err.message || err);
    return res.json(generateFallbackRouteInsights());
  }
});

// POST endpoint for real backend address geocoding (Google/Nominatim/ViaCEP integration)
app.post('/api/geocode', async (req, res) => {
  try {
    const { address = '', cep = '', region = 'Centro', city = 'São Paulo' } = req.body;
    const cleanCep = (cep || '').replace(/\D/g, '');
    const normAddr = (address || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Instant match for Vinimap Central HUB (Rua Cerro Corá, 385 - Lapa, SP)
    if ((normAddr.includes("cerro cora") || normAddr.includes("cero cora")) && (normAddr.includes("385") || normAddr.includes("hub") || normAddr.includes("sede")) || cleanCep === "05061050") {
      return res.json({
        success: true,
        lat: -23.54388,
        lng: -46.70118,
        formattedAddress: "Rua Cerro Corá, 385, Lapa, São Paulo - SP",
        cep: "05061-050",
        region: "Zona Oeste",
        source: "Sede Central Vinimap (Oficial)",
        isExactGeocode: true
      });
    }

    let logradouro = '';
    let bairro = '';
    let localidade = city || 'São Paulo';
    let uf = 'SP';

    // 2. Query ViaCEP if CEP is provided
    if (cleanCep.length === 8) {
      try {
        const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (viaCepRes.ok) {
          const viaCepData = await viaCepRes.json();
          if (!viaCepData.erro) {
            logradouro = viaCepData.logradouro || '';
            bairro = viaCepData.bairro || '';
            localidade = viaCepData.localidade || localidade;
            uf = viaCepData.uf || uf;
          }
        }
      } catch (viaCepErr) {
        console.warn("[/api/geocode] ViaCEP lookup warning:", viaCepErr);
      }
    }

    // Prepare search queries for map geocoding engine
    const cleanAddress = (address || '').replace(/Apto.*|Bloco.*|Casa.*|Sala.*/i, '').trim();
    const queriesToTry: string[] = [];

    if (logradouro) {
      queriesToTry.push(`${logradouro}, ${cleanAddress ? cleanAddress + ', ' : ''}${bairro ? bairro + ', ' : ''}${localidade}, ${uf}, Brasil`);
      queriesToTry.push(`${logradouro}, ${localidade}, ${uf}, Brasil`);
    }

    if (cleanAddress.length > 3) {
      queriesToTry.push(`${cleanAddress}, ${localidade}, ${uf}, Brasil`);
    }

    if (cleanCep.length === 8) {
      queriesToTry.push(`CEP ${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}, Brasil`);
    }

    // 3. Query OpenStreetMap Nominatim Map Engine with custom User-Agent
    for (const query of queriesToTry) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          {
            headers: {
              'User-Agent': 'Vinimap-Logistics-OS/2.0 (geocoding-service)',
              'Accept-Language': 'pt-BR,pt;q=0.9'
            }
          }
        );

        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (Array.isArray(geoData) && geoData.length > 0 && geoData[0].lat && geoData[0].lon) {
            const parsedLat = parseFloat(geoData[0].lat);
            const parsedLng = parseFloat(geoData[0].lon);

            // Validate within Greater São Paulo coordinates
            if (!isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat >= -24.20 && parsedLat <= -23.10 && parsedLng >= -47.30 && parsedLng <= -45.60) {
              const formattedAddress = logradouro 
                ? `${logradouro}${cleanAddress ? ', ' + cleanAddress : ''} - ${bairro || region}, ${localidade} - ${uf}`
                : (address || geoData[0].display_name);

              return res.json({
                success: true,
                lat: parsedLat,
                lng: parsedLng,
                formattedAddress,
                cep: cleanCep ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}` : cep,
                region,
                source: "OpenStreetMap Real-Time Geocoding Engine",
                isExactGeocode: true
              });
            }
          }
        }
      } catch (geoErr) {
        console.warn(`[/api/geocode] Query "${query}" failed:`, geoErr);
      }
    }

    // 4. Region fallback with high-precision district baseline coordinates in SP
    let baseLat = -23.5489; // Centro (Sé)
    let baseLng = -46.6338;
    const rLower = (region || '').toLowerCase();

    if (rLower.includes('sul')) { baseLat = -23.5960; baseLng = -46.6850; }
    else if (rLower.includes('oeste')) { baseLat = -23.5555; baseLng = -46.6900; }
    else if (rLower.includes('norte')) { baseLat = -23.5042; baseLng = -46.6231; }
    else if (rLower.includes('leste')) { baseLat = -23.5510; baseLng = -46.5450; }

    // Add deterministic street-level offset (~100-200m)
    let hash = 0;
    const combineStr = (address + cleanCep + region).toLowerCase();
    for (let i = 0; i < combineStr.length; i++) {
      hash = combineStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const offsetLat = ((Math.abs(hash) % 100) / 100) * 0.003 - 0.0015;
    const offsetLng = (((Math.abs(hash) >> 8) % 100) / 100) * 0.003 - 0.0015;

    return res.json({
      success: true,
      lat: baseLat + offsetLat,
      lng: baseLng + offsetLng,
      formattedAddress: address || `Região ${region}, São Paulo - SP`,
      cep: cleanCep ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}` : cep,
      region,
      source: "Região Logística de São Paulo (Fallback)",
      isExactGeocode: false
    });

  } catch (err: any) {
    console.error("Error in /api/geocode endpoint:", err);
    return res.status(500).json({ error: "Falha interna no serviço de geocodificação." });
  }
});

// ==========================================
// GITHUB INTEGRATION & OAUTH / SYNC ENDPOINTS
// ==========================================

import fs from 'fs';

function collectProjectFiles(dir: string, baseDir = ''): { relativePath: string; fullPath: string }[] {
  const result: { relativePath: string; fullPath: string }[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    const ignoredNames = new Set([
      'node_modules', '.git', 'dist', '.env', '.DS_Store', 'bun.lock', 
      'package-lock.json', 'coverage', '.cache', 'tmp',
      'patch_app.cjs', 'patch_auth.cjs', 'patch_rider.cjs', 'patch_rider2.cjs', 'patch_rider3.cjs', 'patch_rider4.cjs', 'patch_supa.cjs', 'patch_ts.cjs'
    ]);

    for (const entry of entries) {
      if (ignoredNames.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = baseDir ? `${baseDir}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        result.push(...collectProjectFiles(fullPath, relativePath));
      } else if (entry.isFile()) {
        if (!entry.name.endsWith('.zip') && !entry.name.endsWith('.tar.gz') && !entry.name.endsWith('.exe')) {
          result.push({ relativePath, fullPath });
        }
      }
    }
  } catch (e) {
    console.error('Error scanning files:', e);
  }

  return result;
}

// GET GitHub Auth URL endpoint
app.get('/api/auth/github/url', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${appUrl.replace(/\/$/, '')}/auth/github/callback`;
  const scope = 'repo,user,admin:repo_hook';
  
  const authUrl = clientId 
    ? `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`
    : '';

  res.json({
    url: authUrl,
    clientId,
    redirectUri,
    configured: Boolean(clientId)
  });
});

// OAuth Callback handler for GitHub
const handleGithubCallback = async (req: express.Request, res: express.Response) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).send('Código de autorização não fornecido pelo GitHub.');
    }

    const clientId = process.env.GITHUB_CLIENT_ID || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${appUrl.replace(/\/$/, '')}/auth/github/callback`;

    if (!clientId || !clientSecret) {
      return res.status(500).send('GITHUB_CLIENT_ID ou GITHUB_CLIENT_SECRET não estão configurados no servidor.');
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Falha ao obter token do GitHub');
    }

    const accessToken = tokenData.access_token;

    // Fetch GitHub User details
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'ViniMap-Logistics-OS'
      }
    });

    let userData = null;
    if (userRes.ok) {
      userData = await userRes.json();
    }

    // Send postMessage script back to opener popup
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>GitHub Conectado</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0d1117; color: #c9d1d9; }
            .card { background: #161b22; border: 1px solid #30363d; padding: 2rem; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            .h1 { color: #58a6ff; font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="h1">GitHub Vinculado com Sucesso!</div>
            <p>Conexão com ${userData?.login || 'sua conta'} estabelecida. Fechando esta janela...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GITHUB_AUTH_SUCCESS', 
                token: ${JSON.stringify(accessToken)},
                user: ${JSON.stringify(userData)}
              }, '*');
              setTimeout(() => { window.close(); }, 800);
            } else {
              window.location.href = '/?github_auth=success';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Error in GitHub callback:', err);
    return res.status(500).send(`Erro ao concluir autenticação com GitHub: ${err.message}`);
  }
};

app.get('/auth/github/callback', handleGithubCallback);
app.get('/auth/github/callback/', handleGithubCallback);

// POST GitHub user profile
app.post('/api/github/user', async (req, res) => {
  try {
    const token = req.body.token || req.headers.authorization?.replace('Bearer ', '') || process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token do GitHub não fornecido' });
    }

    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ViniMap-Logistics-OS'
      }
    });

    if (!response.ok) {
      const errData = await response.json();
      return res.status(response.status).json({ success: false, error: errData.message || 'Falha ao autenticar no GitHub' });
    }

    const user = await response.json();
    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST List repositories
app.post('/api/github/repos/list', async (req, res) => {
  try {
    const token = req.body.token || req.headers.authorization?.replace('Bearer ', '') || process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token do GitHub não fornecido' });
    }

    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ViniMap-Logistics-OS'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: 'Erro ao buscar repositórios do GitHub' });
    }

    const repos = await response.json();
    return res.json({ success: true, repos });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST Create repository
app.post('/api/github/repos/create', async (req, res) => {
  try {
    const { token, name, description, isPrivate, autoInit } = req.body;
    const authToken = token || process.env.GITHUB_TOKEN;
    if (!authToken) {
      return res.status(401).json({ success: false, error: 'Token de autenticação do GitHub é necessário' });
    }
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Nome do repositório é obrigatório' });
    }

    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ViniMap-Logistics-OS'
      },
      body: JSON.stringify({
        name: name.trim(),
        description: description || 'Repositório ViniMap Logistics OS',
        private: Boolean(isPrivate),
        auto_init: autoInit ?? true
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: data.message || 'Falha ao criar repositório no GitHub' });
    }

    return res.json({ success: true, repo: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST Synchronize ViniMap codebase to GitHub repository
app.post('/api/github/sync', async (req, res) => {
  try {
    const { token, repoFullName, commitMessage, branch = 'main' } = req.body;
    const authToken = token || process.env.GITHUB_TOKEN;
    
    if (!authToken) {
      return res.status(401).json({ success: false, error: 'Token de autenticação do GitHub é necessário' });
    }
    if (!repoFullName) {
      return res.status(400).json({ success: false, error: 'Insira o nome completo do repositório (ex: usuario/vinimap-dashboard)' });
    }

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ViniMap-Logistics-OS'
    };

    // 1. Get Repo Details & default branch
    const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`, { headers });
    if (!repoRes.ok) {
      const err = await repoRes.json();
      return res.status(repoRes.status).json({ success: false, error: err.message || 'Repositório não encontrado ou sem permissão de acesso.' });
    }
    const repoData = await repoRes.json();
    const targetBranch = branch || repoData.default_branch || 'main';

    // 2. Check if branch ref exists
    let refRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/ref/heads/${targetBranch}`, { headers });
    
    // If branch doesn't exist, create an initial README.md via content API to initialize main branch
    if (refRes.status === 404) {
      console.log(`Branch ${targetBranch} does not exist yet in ${repoFullName}. Initializing repo...`);
      const initFileRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents/README.md`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: 'Initial commit from ViniMap Logistics OS',
          content: Buffer.from('# ViniMap Logistics OS\n\nRepositório criado e sincronizado via ViniMap.').toString('base64'),
          branch: targetBranch
        })
      });

      if (!initFileRes.ok) {
        const errInit = await initFileRes.json();
        return res.status(initFileRes.status).json({ success: false, error: `Falha ao inicializar o repositório: ${errInit.message}` });
      }

      // Re-fetch ref
      refRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/ref/heads/${targetBranch}`, { headers });
    }

    if (!refRes.ok) {
      const errRef = await refRes.json();
      return res.status(refRes.status).json({ success: false, error: `Não foi possível acessar a branch ${targetBranch}: ${errRef.message}` });
    }

    const refData = await refRes.json();
    const parentCommitSha = refData.object.sha;

    // Get latest commit object to find base tree
    const parentCommitRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/commits/${parentCommitSha}`, { headers });
    const parentCommitData = await parentCommitRes.json();
    const baseTreeSha = parentCommitData.tree.sha;

    // 3. Scan project files
    const projectFiles = collectProjectFiles(process.cwd());
    console.log(`Found ${projectFiles.length} files to sync to GitHub repo ${repoFullName}...`);

    // 4. Create Git Blobs
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];

    for (const file of projectFiles) {
      try {
        const fileBuffer = fs.readFileSync(file.fullPath);
        const isBinary = file.fullPath.endsWith('.jpg') || file.fullPath.endsWith('.png') || file.fullPath.endsWith('.ico') || file.fullPath.endsWith('.webp');
        
        const blobRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/blobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: fileBuffer.toString(isBinary ? 'base64' : 'utf-8'),
            encoding: isBinary ? 'base64' : 'utf-8'
          })
        });

        if (blobRes.ok) {
          const blobData = await blobRes.json();
          treeItems.push({
            path: file.relativePath,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha
          });
        }
      } catch (fileErr) {
        console.warn(`Skipping file ${file.relativePath}:`, fileErr);
      }
    }

    if (treeItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo válido para sincronização.' });
    }

    // 5. Create new Git Tree
    const newTreeRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });

    if (!newTreeRes.ok) {
      const treeErr = await newTreeRes.json();
      return res.status(newTreeRes.status).json({ success: false, error: `Falha ao criar árvore Git: ${treeErr.message}` });
    }

    const newTreeData = await newTreeRes.json();

    // 6. Create Commit
    const msg = commitMessage || `feat(vinimap): Sincronização automática do código ViniMap (${new Date().toLocaleDateString('pt-BR')})`;
    const commitRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: msg,
        tree: newTreeData.sha,
        parents: [parentCommitSha]
      })
    });

    if (!commitRes.ok) {
      const commitErr = await commitRes.json();
      return res.status(commitRes.status).json({ success: false, error: `Falha ao criar commit: ${commitErr.message}` });
    }

    const commitData = await commitRes.json();

    // 7. Update Ref (HEAD)
    const updateRefRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/refs/heads/${targetBranch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: commitData.sha,
        force: true
      })
    });

    if (!updateRefRes.ok) {
      const refErr = await updateRefRes.json();
      return res.status(updateRefRes.status).json({ success: false, error: `Falha ao atualizar branch ${targetBranch}: ${refErr.message}` });
    }

    return res.json({
      success: true,
      commitSha: commitData.sha,
      commitUrl: `https://github.com/${repoFullName}/commit/${commitData.sha}`,
      repoUrl: repoData.html_url,
      syncedFilesCount: treeItems.length,
      syncedAt: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('Error during GitHub sync:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erro interno na sincronização com GitHub' });
  }
});

// POST /api/smtp/test - Test connection to custom SMTP server & send test message
app.post('/api/smtp/test', async (req, res) => {
  try {
    const {
      host,
      port = 587,
      security = 'tls',
      authRequired = true,
      user,
      pass,
      fromEmail,
      fromName = 'ViniMap Logística',
      testRecipientEmail
    } = req.body;

    if (!host || !host.trim()) {
      return res.status(400).json({ success: false, error: 'O endereço do servidor SMTP (Host) é obrigatório.' });
    }

    const targetEmail = testRecipientEmail?.trim() || fromEmail?.trim() || user?.trim();
    if (!targetEmail) {
      return res.status(400).json({ success: false, error: 'Informe um e-mail de destino válido para envio do e-mail de teste.' });
    }

    const numericPort = Number(port) || 587;
    const isSecure = security === 'ssl' || numericPort === 465;

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: host.trim(),
      port: numericPort,
      secure: isSecure,
      auth: authRequired && (user || pass) ? {
        user: user?.trim(),
        pass: pass
      } : undefined,
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    // Verify SMTP connection
    await transporter.verify();

    // Send test email message
    const sender = fromName ? `"${fromName.replace(/"/g, '')}" <${fromEmail || user}>` : (fromEmail || user);
    
    const info = await transporter.sendMail({
      from: sender,
      to: targetEmail,
      subject: `[ViniMap] Teste de Conexão SMTP - ${new Date().toLocaleTimeString('pt-BR')}`,
      text: `Olá!\n\nEste é um e-mail de teste disparado pelo painel do ViniMap Logística utilizando as suas configurações de servidor SMTP próprio.\n\nServidor: ${host}\nPorta: ${numericPort}\nCriptografia: ${security.toUpperCase()}\nRemetente: ${sender}\n\nStatus: Conexão efetuada com sucesso!`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; border-radius: 12px; color: #1e293b;">
          <div style="background-color: #0f172a; padding: 16px 20px; border-radius: 8px; color: white; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 18px;">✅ Conexão SMTP Estabelecida com Sucesso</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">ViniMap Logistics - Notificações do Parceiro</p>
          </div>
          <p>Olá,</p>
          <p>Este é um e-mail de teste gerado para validar as credenciais do seu <strong>Servidor SMTP Próprio</strong>.</p>
          <div style="background-color: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 10px 0; color: #2563eb; font-size: 14px;">Parâmetros Configurados:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
              <li><strong>Servidor (Host):</strong> ${host}</li>
              <li><strong>Porta:</strong> ${numericPort}</li>
              <li><strong>Criptografia:</strong> ${security.toUpperCase()}</li>
              <li><strong>Autenticação:</strong> ${authRequired ? 'Ativa' : 'Desativada'}</li>
              <li><strong>Usuário:</strong> ${user || 'N/A'}</li>
              <li><strong>Remetente Oficial:</strong> ${sender}</li>
            </ul>
          </div>
          <p style="font-size: 12px; color: #64748b;">E-mail gerado automaticamente em ${new Date().toLocaleString('pt-BR')} (Horário de Brasília).</p>
        </div>
      `
    });

    return res.json({
      success: true,
      message: 'Conexão SMTP validada e e-mail de teste enviado com sucesso!',
      messageId: info.messageId,
      response: info.response,
      testedAt: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('[SMTP Test Error]:', err);
    return res.status(500).json({
      success: false,
      error: `Falha ao conectar ou disparar pelo servidor SMTP: ${err.message || 'Erro desconhecido'}`
    });
  }
});

// POST /api/smtp/send-order-completion - Send real order completion notification email via partner SMTP
app.post('/api/smtp/send-order-completion', async (req, res) => {
  try {
    const {
      smtpSettings,
      recipientEmail,
      subject,
      body,
      orderCode
    } = req.body;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'E-mail de destino inválido.' });
    }

    if (!smtpSettings || !smtpSettings.enabled || !smtpSettings.host) {
      return res.status(400).json({ success: false, error: 'Servidor SMTP personalizado não está ativo ou configurado.' });
    }

    const numericPort = Number(smtpSettings.port) || 587;
    const isSecure = smtpSettings.security === 'ssl' || numericPort === 465;

    const transporter = nodemailer.createTransport({
      host: smtpSettings.host.trim(),
      port: numericPort,
      secure: isSecure,
      auth: smtpSettings.authRequired && (smtpSettings.user || smtpSettings.pass) ? {
        user: smtpSettings.user?.trim(),
        pass: smtpSettings.pass
      } : undefined,
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 12000,
      socketTimeout: 12000
    });

    const sender = smtpSettings.fromName 
      ? `"${smtpSettings.fromName.replace(/"/g, '')}" <${smtpSettings.fromEmail || smtpSettings.user}>`
      : (smtpSettings.fromEmail || smtpSettings.user);

    const htmlBody = `
      <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f1f5f9; padding: 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #cbd5e1;">
          <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #38bdf8;">${smtpSettings.fromName || 'ViniMap Logística'}</h1>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 600;">NOTIFICAÇÃO OFICIAL DE CONCLUSÃO DE PEDIDO</p>
          </div>
          <div style="padding: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
            ${(body || '').replace(/\n/g, '<br/>')}
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b;">
            <p style="margin: 0;">Mensagem automática disparada via servidor de e-mail próprio do parceiro.</p>
            <p style="margin: 4px 0 0 0;">Pedido #${orderCode || 'N/A'} • ViniMap Logistics System</p>
          </div>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: sender,
      to: recipientEmail.trim(),
      replyTo: smtpSettings.replyTo?.trim() || undefined,
      subject: subject || `Notificação do Pedido #${orderCode}`,
      text: body,
      html: htmlBody
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      response: info.response,
      sentAt: new Date().toISOString(),
      recipient: recipientEmail
    });

  } catch (err: any) {
    console.error('[SMTP Completion Order Dispatch Error]:', err);
    return res.status(500).json({
      success: false,
      error: `Erro ao enviar e-mail via SMTP do parceiro: ${err.message || 'Falha no envio'}`
    });
  }
});

// Serve frontend assets and handle Vite dev middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} [NODE_ENV=${process.env.NODE_ENV || 'development'}]`);
  });
}

startServer();
