// Smoke test for the idea generator. Mirrors wa-smoke-{seed,check}: create a
// throwaway user with a collection of fake-but-realistic items, hit Claude,
// print the result, then delete the user (cascades clean everything else).
//
// Run: npx tsx scripts/ideas-smoke.ts
//
// Requires SAVEHUB_CLAUDE_KEY (or ANTHROPIC_API_KEY) in .env.local.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { prisma } from "../src/lib/db";
import {
  generateIdeasForCollection,
  PLATFORM_LABELS,
  type Platform,
} from "../src/lib/ideas";

// Items chosen to cover a clear theme (produtividade/foco) so the model has
// real signal to riff on. Summaries are the kind of thing summarizeAndSave
// would have written — short, in PT-BR, focused on what's useful.
const FAKE_ITEMS = [
  {
    title: "Deep Work — Cal Newport (resumo do livro)",
    source: "youtube",
    sourceLabel: "YouTube",
    type: "Vídeo",
    url: "https://www.youtube.com/watch?v=fake-deepwork",
    description: "Resumo do Deep Work por um canal de produtividade.",
    summary:
      "Resumo do livro Deep Work argumentando que o trabalho profundo (sem distrações) é cada vez mais raro e valioso. Defende blocos de 90+ minutos sem notificações, rituais de início/fim, e medir resultado pelo output, não pelo tempo. Útil pra repensar agenda de trabalho criativo.",
    tags: '["produtividade","cal newport","deep work","foco"]',
    image: "",
  },
  {
    title: "Como o seu celular sequestra a sua atenção",
    source: "instagram",
    sourceLabel: "Instagram",
    type: "Reels",
    url: "https://www.instagram.com/p/fake-attention",
    description: "Reels sobre design viciante de apps.",
    summary:
      "Reels mostrando como notificações e scroll infinito são desenhados pra disparar dopamina. Sugere desinstalar redes do celular e checar do desktop. Boa referência pra discussão de tempo de tela.",
    tags: '["atenção","celular","redes sociais","dopamina"]',
    image: "",
  },
  {
    title: "Daily review template — Tiago Forte",
    source: "web",
    sourceLabel: "Web",
    type: "Artigo",
    url: "https://example.com/fake-daily-review",
    description: "Template de revisão diária do método Building a Second Brain.",
    summary:
      "Template prático de 3 perguntas pra revisão diária: o que finalizou hoje, o que travou, qual a próxima ação concreta pra amanhã. Liga ao método PARA do Tiago Forte. Útil pra quem quer reduzir a fricção entre planejamento e execução.",
    tags: '["revisão","daily review","building a second brain","método"]',
    image: "",
  },
  {
    title: "Pomodoro modificado pra trabalho criativo",
    source: "twitter",
    sourceLabel: "Twitter",
    type: "Thread",
    url: "https://twitter.com/fake/status/12345",
    description: "Thread sobre adaptar pomodoro pra criativos.",
    summary:
      "Thread defendendo blocos de 50 minutos em vez dos 25 do pomodoro tradicional pra trabalho criativo. Argumento: 25min mal entra em flow, 50min entra e termina antes da fadiga. Útil pra criadores que sentem que pomodoro padrão atrapalha.",
    tags: '["pomodoro","flow","trabalho criativo","timeboxing"]',
    image: "",
  },
];

async function main() {
  const email = "ideas-smoke@savehub.test";

  // Clean any leftover from previous runs (run 2x in a row should work).
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: { email, name: "Ideas Smoke" },
  });
  console.log(`[seed] created user ${user.id}`);

  const collection = await prisma.collection.create({
    data: { userId: user.id, name: "Produtividade" },
  });
  console.log(`[seed] created collection ${collection.id} ("${collection.name}")`);

  for (const it of FAKE_ITEMS) {
    await prisma.savedItem.create({
      data: {
        ...it,
        userId: user.id,
        collectionId: collection.id,
        status: "Para usar",
        summarized: true,
      },
    });
  }
  console.log(`[seed] inserted ${FAKE_ITEMS.length} items`);

  const platforms: Platform[] = ["instagram-reels", "youtube-short"];

  try {
    for (const platform of platforms) {
      console.log(`\n[generate] ${PLATFORM_LABELS[platform]} ...`);
      const t0 = Date.now();
      const ideas = await generateIdeasForCollection(collection.id, {
        platform,
        count: 2,
      });
      const dt = Date.now() - t0;
      console.log(`[generate] got ${ideas.length} ideas in ${dt}ms`);
      console.log(JSON.stringify(ideas, null, 2));
    }
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    console.log("\n[cleanup] user + cascades deleted");
  }
}

main()
  .catch((err) => {
    console.error("[smoke] FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
