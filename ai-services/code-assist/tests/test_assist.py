from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import _retrieve, _split_snippets, heuristic_answer  # noqa: E402

CONTEXT = """=== src/auth/service.ts ===
export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new UnauthorizedException();
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new UnauthorizedException();
  return issueTokens(user.id);
}

=== src/billing/invoice.ts ===
export async function createInvoice(orgId: string, amount: number) {
  return prisma.invoice.create({ data: { orgId, amount, status: 'SENT' } });
}
"""


def test_split_snippets_finds_files():
    snippets = _split_snippets(CONTEXT)
    assert len(snippets) == 2
    assert snippets[0].startswith("src/auth/service.ts")


def test_retrieval_ranks_auth_snippet_first():
    results = _retrieve("how does user login work with bcrypt", CONTEXT)
    assert results, "expected at least one retrieved snippet"
    assert "auth" in results[0]


def test_retrieval_empty_on_no_match():
    results = _retrieve("kubernetes ingress controller setup", CONTEXT)
    assert results == []


def test_heuristic_answer_mentions_no_context():
    answer = heuristic_answer("quantum computing question", [])
    assert "No matching project context" in answer
