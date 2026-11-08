#!/usr/bin/env python3
"""
اختبار حمل (Load & Concurrency Test) لطبقة الـ Orchestrator:
- يختبر سعة التحمل المتزامنة (Concurrent Users) لـ:
  1. قدرة الـ Orchestrator نفسه (مع زمن استدلال محاكى لـ vLLM Qwen3-8B على RTX 5070 Ti مع max-num-seqs=4).
  2. ويمكن تشغيله ضد خادم حي بتمرير ORCHESTRATOR_LIVE_URL.
- يطبع جدولاً واضحاً لعدد المستخدمين المتزامنين (4، 10، 20، 40) ونسبة النجاح وزمن الاستجابة p50 وp95 وp99.
"""
import asyncio
import json
import os
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ORCHESTRATOR_SERVICE_KEY", "load-test-secret-key-32-bytes-long")
os.environ.setdefault("AGENT_BACKEND", "mock")
os.environ.setdefault("RATE_LIMIT_TEACHER_PER_MIN", "1000")

import httpx
import logging
from app.main import app
from app.llm_client import set_mock_llm_transport
from app.rate_limit import rate_limiter
from app.resilience import llm_circuit

logging.getLogger("manarasy.orchestrator").setLevel(logging.WARNING)


def install_realistic_gpu_simulator(gpu_max_num_seqs: int = 4, base_gpu_latency_s: float = 0.18):
    """
    يحاكي سلوك vLLM الحقيقي عند ضبط --max-num-seqs=4:
    حتى 4 طلبات تُعالج بالتوازي في الدفعة نفسها (~180ms)، وما زاد عنها ينتظر في طابور vLLM.
    """
    sem = asyncio.Semaphore(gpu_max_num_seqs)

    async def simulated_vllm(request: httpx.Request) -> httpx.Response:
        async with sem:
            await asyncio.sleep(base_gpu_latency_s)
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": "تم تحليل أداء الحلقة بنجاح."}}],
                    "usage": {"prompt_tokens": 45, "completion_tokens": 20},
                },
            )

    set_mock_llm_transport(httpx.MockTransport(simulated_vllm))


async def run_tier(concurrency: int, total_requests: int) -> dict:
    rate_limiter.reset()
    llm_circuit.reset()
    transport = httpx.ASGITransport(app=app)
    latencies_ms: list[float] = []
    successes = 0
    degraded = 0
    errors = 0

    t_start = time.perf_counter()
    async with httpx.AsyncClient(transport=transport, base_url="http://orchestrator.local") as client:
        sem = asyncio.Semaphore(concurrency)

        async def _worker(idx: int):
            nonlocal successes, degraded, errors
            async with sem:
                headers = {
                    "Authorization": f"Bearer {os.environ['ORCHESTRATOR_SERVICE_KEY']}",
                    "X-User-Id": f"teacher-{idx % concurrency}",
                    "X-User-Role": "TEACHER",
                    "X-Tenant-Id": "t1",
                }
                req_t0 = time.perf_counter()
                try:
                    r = await client.post("/v1/chat", headers=headers, json={"message": f"سؤال رقم {idx}"})
                    dt = (time.perf_counter() - req_t0) * 1000
                    latencies_ms.append(dt)
                    if r.status_code == 200:
                        if r.json().get("ai_available"):
                            successes += 1
                        else:
                            degraded += 1
                    else:
                        errors += 1
                except Exception:
                    errors += 1

        await asyncio.gather(*(_worker(i) for i in range(total_requests)))

    wall_s = time.perf_counter() - t_start
    latencies_ms.sort()
    p50 = statistics.median(latencies_ms) if latencies_ms else 0.0
    p95 = latencies_ms[int(len(latencies_ms) * 0.95) - 1] if latencies_ms else 0.0
    p99 = latencies_ms[int(len(latencies_ms) * 0.99) - 1] if latencies_ms else 0.0
    rps = total_requests / wall_s if wall_s > 0 else 0.0

    return {
        "concurrency": concurrency,
        "total_requests": total_requests,
        "successes": successes,
        "degraded": degraded,
        "errors": errors,
        "rps": round(rps, 2),
        "p50_ms": round(p50, 1),
        "p95_ms": round(p95, 1),
        "p99_ms": round(p99, 1),
    }


async def main():
    install_realistic_gpu_simulator(gpu_max_num_seqs=4, base_gpu_latency_s=0.18)
    print("=" * 78)
    print("تقرير اختبار الحمل المتزامن (Orchestrator + Simulated vLLM max-num-seqs=4)")
    print("=" * 78)
    print(f"{'Concurrent':<12} {'Requests':<10} {'OK':<6} {'Degraded':<10} {'RPS':<8} {'p50(ms)':<10} {'p95(ms)':<10} {'p99(ms)':<10}")
    print("-" * 78)
    results = []
    for conc, reqs in [(4, 16), (10, 30), (20, 40), (40, 80)]:
        stats = await run_tier(conc, reqs)
        results.append(stats)
        print(
            f"{stats['concurrency']:<12} {stats['total_requests']:<10} {stats['successes']:<6} "
            f"{stats['degraded']:<10} {stats['rps']:<8} {stats['p50_ms']:<10} {stats['p95_ms']:<10} {stats['p99_ms']:<10}"
        )
    print("=" * 78)
    set_mock_llm_transport(None)


if __name__ == "__main__":
    asyncio.run(main())
