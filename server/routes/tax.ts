import crypto from 'crypto';
import { Router } from 'express';
import { db } from '../lib/db.js';
import { TaxScenarioBodySchema, TaxSettingsBodySchema } from '../lib/validation.js';

export function createTaxRouter(store = db): Router {
    const router = Router();

    router.get('/tax-scenarios', (_req, res) => {
        const scenarios = store.read().taxScenarios ?? [];
        const sorted = [...scenarios].sort(
            (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
        res.json(sorted);
    });

    router.post('/tax-scenarios', async (req, res, next) => {
        const parsed = TaxScenarioBodySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Invalid tax scenario payload',
                issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
            });
            return;
        }

        const data = parsed.data;
        const isSpousal = Boolean(data.isSpousal);
        const newScenario = {
            id: `ts_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            savedAt: new Date().toISOString(),
            annualIncome: data.annualIncome,
            quebecTaxableIncome: data.quebecTaxableIncome ?? data.annualIncome,
            rrspContribution: data.rrspContribution,
            totalRefund: data.totalRefund,
            craRefund: data.craRefund ?? null,
            rqRefund: data.rqRefund ?? null,
            effectiveRate: data.effectiveRate,
            isSpousal,
            attributionDate: isSpousal ? (data.attributionDate ?? new Date().toISOString()) : null,
        };

        try {
            await store.mutate((draft) => {
                if (!Array.isArray(draft.taxScenarios)) {
                    draft.taxScenarios = [];
                }
                draft.taxScenarios.push(newScenario);
            });
            res.json(newScenario);
        } catch (err) {
            next(err);
        }
    });

    router.delete('/tax-scenarios/:id', async (req, res, next) => {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: 'Scenario id is required' });
            return;
        }
        try {
            await store.mutate((draft) => {
                if (Array.isArray(draft.taxScenarios)) {
                    draft.taxScenarios = draft.taxScenarios.filter((s) => s.id !== id);
                }
            });
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    });

    router.get('/tax-settings', (_req, res) => {
        res.json(store.read().taxSettings ?? null);
    });

    router.post('/tax-settings', async (req, res, next) => {
        const parsed = TaxSettingsBodySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Invalid tax settings payload',
                issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
            });
            return;
        }
        try {
            await store.mutate((draft) => {
                draft.taxSettings = parsed.data;
            });
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
