import {
  BillPerson,
  BillSession,
  ReceiptImageTheme,
  TransferFeeSettings,
} from '../types';
import { BillComputation, formatMinorMoney } from './billSplitEngine';

export type ShareScope = 'whole_bill' | 'selected_people';

export interface PerPersonSharePayload {
  personId: string;
  personName: string;
  amountMinor: number;
  feeMinor: number;
  totalWithFeeMinor: number;
  paidFlag: boolean;
  text: string;
}

function lri(text: string): string {
  return `\u2066${text}\u2069`;
}

export function computePersonTransferFee(
  amountMinor: number,
  _paymentInfo?: BillSession['paymentInfo'],
  _feeSettings?: Partial<TransferFeeSettings> | null
): { baseMinor: number; feeMinor: number; totalWithFeeMinor: number } {
  const baseMinor = Math.max(0, Math.round(amountMinor));
  return {
    baseMinor,
    feeMinor: 0,
    totalWithFeeMinor: baseMinor,
  };
}

function formatDateShort(ts: number, lang: 'ar' | 'en'): string {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

export function buildPaymentFooterLines(
  _amountMinor: number,
  _currency: string,
  paymentInfo: BillSession['paymentInfo'],
  lang: 'ar' | 'en',
  _feeSettings?: Partial<TransferFeeSettings> | null
): string[] {
  if (!paymentInfo) return [];
  const hasAny = Boolean(paymentInfo.instaPay?.trim() || paymentInfo.wallet?.trim() || paymentInfo.note?.trim());
  if (!hasAny) return [];

  const isAr = lang === 'ar';
  const lines: string[] = [];
  lines.push(isAr ? '💳 بيانات التحويل:' : '💳 Payment Details:');
  if (paymentInfo.instaPay?.trim()) {
    lines.push(`${isAr ? '• إنستاباي:' : '• InstaPay:'} ${paymentInfo.instaPay.trim()}`);
  }
  if (paymentInfo.wallet?.trim()) {
    lines.push(`${isAr ? '• محفظة إلكترونية:' : '• Wallet:'} ${paymentInfo.wallet.trim()}`);
  }
  if (paymentInfo.note?.trim()) {
    lines.push(`• ${paymentInfo.note.trim()}`);
  }
  return lines;
}

export function buildBillShareText(
  session: BillSession,
  computation: BillComputation,
  options: {
    scope?: ShareScope;
    selectedPersonIds?: string[];
    lang?: 'ar' | 'en';
    feeSettings?: Partial<TransferFeeSettings> | null;
    liveUrl?: string;
    isReminder?: boolean;
  } = {}
): string {
  const lang = options.lang || 'ar';
  const isAr = lang === 'ar';
  const scope = options.scope || 'whole_bill';
  const currency = session.currency || '£';
  const title = session.title.trim() || (isAr ? 'تقسيم الحساب' : 'Bill Split');
  const approvedPeople = session.people.filter((p) => p.approval === 'approved');

  const targetPeople: BillPerson[] =
    scope === 'selected_people' && options.selectedPersonIds?.length
      ? approvedPeople.filter((p) => options.selectedPersonIds!.includes(p.id))
      : approvedPeople;

  const lines: string[] = [];
  if (options.isReminder) {
    lines.push(
      isAr
        ? `⏰ تذكير بحساب: ${session.icon} ${title}`
        : `⏰ Payment reminder for ${session.icon} ${title}`
    );
  } else {
    lines.push(`${session.icon} ${title}`);
  }
  lines.push(`📅 ${formatDateShort(session.updatedAt || session.createdAt, lang)}`);
  lines.push('');

  if (scope === 'whole_bill') {
    lines.push(isAr ? '📋 الأصناف:' : '📋 Items:');
    for (const item of session.items) {
      const lineTotal = lri(formatMinorMoney(computation.allocation.itemTotalsMinor[item.id] || 0, currency, lang));
      const qtyLabel = item.qty !== 1 ? ` ×${item.qty}` : '';
      lines.push(`• ${item.name}${qtyLabel} — ${lineTotal}`);
    }
    if (computation.extras.perExtraBreakdown.length > 0) {
      lines.push('');
      lines.push(isAr ? '➕ الإضافات والخصومات:' : '➕ Extras & Discounts:');
      for (const ex of computation.extras.perExtraBreakdown) {
        const signPrefix = ex.computedMinor >= 0 ? '+' : '';
        lines.push(`• ${ex.label}: ${lri(signPrefix + formatMinorMoney(ex.computedMinor, currency, lang))}`);
      }
    }
    lines.push('');
    lines.push(
      isAr
        ? `💰 الإجمالي: ${lri(formatMinorMoney(computation.computedTotalMinor, currency, lang))}`
        : `💰 Total: ${lri(formatMinorMoney(computation.computedTotalMinor, currency, lang))}`
    );
    lines.push('');
    lines.push(isAr ? '👥 نصيب كل شخص:' : '👥 Individual Shares:');
    for (const person of targetPeople) {
      const share = computation.finalPersonTotalsMinor[person.id] || 0;
      const statusBadge = person.paidFlag ? (isAr ? ' ✅ تم الدفع' : ' ✅ Paid') : '';
      lines.push(`• ${person.name}: ${lri(formatMinorMoney(share, currency, lang))}${statusBadge}`);
    }
  } else {
    // Specific people (1 or multiple) with their exact itemized breakdown
    let selectedTotalMinor = 0;
    for (const person of targetPeople) {
      const personTotal = computation.finalPersonTotalsMinor[person.id] || 0;
      selectedTotalMinor += personTotal;
      const personItems = computation.allocation.perPersonBreakdown[person.id] || [];
      const personExtras = computation.extras.perPersonExtrasMinor[person.id] || 0;
      const roundingDelta = computation.rounding.perPersonRoundingDeltaMinor[person.id] || 0;

      lines.push(
        `👤 ${person.name} — ${lri(formatMinorMoney(personTotal, currency, lang))}${person.paidFlag ? (isAr ? ' ✅' : ' ✅') : ''}`
      );
      for (const line of personItems) {
        const shareStr = lri(formatMinorMoney(line.shareMinor, currency, lang));
        lines.push(`   • ${line.name} (${line.qtyShare}) = ${shareStr}`);
      }
      if (personExtras !== 0) {
        const extraSign = personExtras > 0 ? '+' : '';
        lines.push(
          isAr
            ? `   • ضريبة ورسوم: ${lri(extraSign + formatMinorMoney(personExtras, currency, lang))}`
            : `   • Tax & Extras: ${lri(extraSign + formatMinorMoney(personExtras, currency, lang))}`
        );
      }
      if (roundingDelta !== 0) {
        const rSign = roundingDelta > 0 ? '+' : '';
        lines.push(
          isAr
            ? `   • تقريب: ${lri(rSign + formatMinorMoney(roundingDelta, currency, lang))}`
            : `   • Rounding: ${lri(rSign + formatMinorMoney(roundingDelta, currency, lang))}`
        );
      }
      lines.push('');
    }
    if (targetPeople.length > 1) {
      lines.push(
        isAr
          ? `💰 مجموع المختارين: ${lri(formatMinorMoney(selectedTotalMinor, currency, lang))}`
          : `💰 Selected Subtotal: ${lri(formatMinorMoney(selectedTotalMinor, currency, lang))}`
      );
      lines.push('');
    }
  }

  const targetTotalMinor =
    scope === 'whole_bill'
      ? computation.settlement.ownerOwedByOthersMinor || computation.computedTotalMinor
      : targetPeople.reduce((acc, p) => acc + (computation.finalPersonTotalsMinor[p.id] || 0), 0);

  const paymentLines = buildPaymentFooterLines(
    targetTotalMinor,
    currency,
    session.paymentInfo,
    lang,
    options.feeSettings
  );
  if (paymentLines.length > 0) {
    lines.push(...paymentLines);
  }

  if (options.liveUrl) {
    lines.push('');
    lines.push(isAr ? `🔗 رابط الحساب المباشر: ${options.liveUrl}` : `🔗 Live bill link: ${options.liveUrl}`);
  }

  lines.push('');
  lines.push(isAr ? 'تم الحساب بواسطة تطبيق solv' : 'Calculated with solv');

  return lines.join('\n').trim();
}

export function buildPerPersonShareMessages(
  session: BillSession,
  computation: BillComputation,
  options: {
    lang?: 'ar' | 'en';
    unpaidOnly?: boolean;
    isReminder?: boolean;
    feeSettings?: Partial<TransferFeeSettings> | null;
    liveUrl?: string;
  } = {}
): PerPersonSharePayload[] {
  const lang = options.lang || 'ar';
  const people = session.people.filter(
    (p) =>
      p.approval === 'approved' &&
      p.kind !== 'owner' &&
      (!options.unpaidOnly || !p.paidFlag)
  );

  return people.map((p) => {
    const amountMinor = computation.finalPersonTotalsMinor[p.id] || 0;
    const feeInfo = computePersonTransferFee(amountMinor, session.paymentInfo, options.feeSettings);
    const text = buildBillShareText(session, computation, {
      scope: 'selected_people',
      selectedPersonIds: [p.id],
      lang,
      feeSettings: options.feeSettings,
      liveUrl: options.liveUrl,
      isReminder: options.isReminder,
    });
    return {
      personId: p.id,
      personName: p.name,
      amountMinor,
      feeMinor: feeInfo.feeMinor,
      totalWithFeeMinor: feeInfo.totalWithFeeMinor,
      paidFlag: p.paidFlag,
      text,
    };
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBiDiRow(
  ctx: CanvasRenderingContext2D,
  opts: {
    label: string;
    amountStr: string;
    xLeft: number;
    xRight: number;
    y: number;
    isRtl: boolean;
    labelColor: string;
    amountColor: string;
    labelFont: string;
    amountFont: string;
    maxLabelWidth?: number;
  }
): void {
  const {
    label,
    amountStr,
    xLeft,
    xRight,
    y,
    isRtl,
    labelColor,
    amountColor,
    labelFont,
    amountFont,
    maxLabelWidth = xRight - xLeft - 240,
  } = opts;

  ctx.save();
  ctx.font = amountFont;
  ctx.fillStyle = amountColor;
  ctx.direction = 'ltr';
  ctx.textAlign = isRtl ? 'left' : 'right';
  ctx.fillText(lri(amountStr), isRtl ? xLeft : xRight, y);
  ctx.restore();

  ctx.save();
  ctx.font = labelFont;
  ctx.fillStyle = labelColor;
  ctx.direction = isRtl ? 'rtl' : 'ltr';
  ctx.textAlign = isRtl ? 'right' : 'left';
  ctx.fillText(label, isRtl ? xRight : xLeft, y, maxLabelWidth);
  ctx.restore();
}

function drawSolvBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  accent: string
): void {
  ctx.save();
  drawRoundedRect(ctx, x, y, size, size, size * 0.28);
  ctx.fillStyle = accent;
  ctx.fill();

  // Crisp check-receipt spark inside icon
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.26, y + size * 0.52);
  ctx.lineTo(x + size * 0.44, y + size * 0.7);
  ctx.lineTo(x + size * 0.75, y + size * 0.34);
  ctx.stroke();
  ctx.restore();
}

export async function renderBillReceiptCanvas(
  session: BillSession,
  computation: BillComputation,
  options: {
    scope?: ShareScope;
    selectedPersonIds?: string[];
    lang?: 'ar' | 'en';
    theme?: ReceiptImageTheme;
    feeSettings?: Partial<TransferFeeSettings> | null;
  } = {}
): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  const lang = options.lang || 'ar';
  const isRtl = lang === 'ar';
  const theme: ReceiptImageTheme = options.theme || 'dark';
  const scope = options.scope || 'whole_bill';
  const currency = session.currency || '£';
  const approvedPeople = session.people.filter((p) => p.approval === 'approved');
  const targetPeople =
    scope === 'selected_people' && options.selectedPersonIds?.length
      ? approvedPeople.filter((p) => options.selectedPersonIds!.includes(p.id))
      : approvedPeople;

  const palette =
    theme === 'light'
      ? {
          bg: '#F5F5F7',
          card: '#FFFFFF',
          cardInner: '#F2F2F7',
          border: 'rgba(0, 0, 0, 0.10)',
          textPrimary: '#1D1D1F',
          textSecondary: '#6E6E73',
          accent: '#059669',
          accentSoft: 'rgba(5, 150, 105, 0.12)',
          success: '#16A34A',
          warning: '#D97706',
        }
      : {
          bg: '#000000',
          card: '#1C1C1E',
          cardInner: '#2C2C2E',
          border: 'rgba(255, 255, 255, 0.12)',
          textPrimary: '#F5F5F7',
          textSecondary: '#98989D',
          accent: '#10B981',
          accentSoft: 'rgba(16, 185, 129, 0.18)',
          success: '#32D74B',
          warning: '#FFD60A',
        };

  const width = 1080;
  const padX = 64;
  const cardPad = 48;
  const xLeft = padX + cardPad;
  const xRight = width - padX - cardPad;

  const itemCount =
    scope === 'whole_bill'
      ? session.items.length + computation.extras.perExtraBreakdown.length
      : targetPeople.reduce(
          (acc, p) => acc + (computation.allocation.perPersonBreakdown[p.id]?.length || 0) + 2,
          0
        );

  const paymentTargetMinor =
    scope === 'whole_bill'
      ? computation.settlement.ownerOwedByOthersMinor || computation.computedTotalMinor
      : targetPeople.reduce((acc, p) => acc + (computation.finalPersonTotalsMinor[p.id] || 0), 0);
  const paymentLines = buildPaymentFooterLines(
    paymentTargetMinor,
    currency,
    session.paymentInfo,
    lang,
    options.feeSettings
  );

  const peopleRows = scope === 'whole_bill' ? targetPeople.length : 0;
  const estimatedHeight = Math.max(
    720,
    460 + itemCount * 56 + peopleRows * 68 + paymentLines.length * 46 + 150
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = estimatedHeight;
  const ctx = canvas.getContext('2d')!;

  const fontSans = isRtl
    ? '"IBM Plex Sans Arabic", "Cairo", "Segoe UI", Tahoma, Arial, sans-serif'
    : '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif';
  const fontMono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  // Background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, estimatedHeight);

  // Outer receipt card
  drawRoundedRect(ctx, padX, 48, width - padX * 2, estimatedHeight - 96, 36);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Brand header: clean "solv" logo + date
  let y = 110;
  drawSolvBadge(ctx, isRtl ? xRight - 52 : xLeft, y - 38, 52, palette.accent);

  ctx.save();
  ctx.font = `800 34px ${fontSans}`;
  ctx.fillStyle = palette.textPrimary;
  ctx.direction = isRtl ? 'rtl' : 'ltr';
  ctx.textAlign = isRtl ? 'right' : 'left';
  ctx.fillText('solv', isRtl ? xRight - 70 : xLeft + 70, y - 2);
  ctx.restore();

  ctx.save();
  ctx.font = `600 22px ${fontSans}`;
  ctx.fillStyle = palette.textSecondary;
  ctx.direction = isRtl ? 'rtl' : 'ltr';
  ctx.textAlign = isRtl ? 'left' : 'right';
  ctx.fillText(formatDateShort(session.updatedAt || session.createdAt, lang), isRtl ? xLeft : xRight, y - 4);
  ctx.restore();

  // Title banner
  y += 66;
  const titleText = `${session.icon} ${session.title.trim() || (isArText(lang) ? 'تقسيم الحساب' : 'Bill Split')}`;
  ctx.save();
  ctx.font = `800 40px ${fontSans}`;
  ctx.fillStyle = palette.textPrimary;
  ctx.direction = isRtl ? 'rtl' : 'ltr';
  ctx.textAlign = isRtl ? 'right' : 'left';
  ctx.fillText(titleText, isRtl ? xRight : xLeft, y, xRight - xLeft);
  ctx.restore();

  // Divider dashed
  y += 42;
  ctx.save();
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xLeft, y);
  ctx.lineTo(xRight, y);
  ctx.stroke();
  ctx.restore();
  y += 50;

  if (scope === 'whole_bill') {
    // Items section
    ctx.save();
    ctx.font = `700 24px ${fontSans}`;
    ctx.fillStyle = palette.accent;
    ctx.direction = isRtl ? 'rtl' : 'ltr';
    ctx.textAlign = isRtl ? 'right' : 'left';
    ctx.fillText(isRtl ? 'الأصناف' : 'ITEMS', isRtl ? xRight : xLeft, y);
    ctx.restore();
    y += 44;

    for (const item of session.items) {
      const amt = formatMinorMoney(computation.allocation.itemTotalsMinor[item.id] || 0, currency, lang);
      const label = item.qty !== 1 ? `${item.name} ×${item.qty}` : item.name;
      drawBiDiRow(ctx, {
        label,
        amountStr: amt,
        xLeft,
        xRight,
        y,
        isRtl,
        labelColor: palette.textPrimary,
        amountColor: palette.textPrimary,
        labelFont: `600 26px ${fontSans}`,
        amountFont: `700 26px ${fontMono}`,
      });
      y += 50;
    }

    if (computation.extras.perExtraBreakdown.length > 0) {
      y += 10;
      for (const ex of computation.extras.perExtraBreakdown) {
        const sign = ex.computedMinor >= 0 ? '+' : '';
        drawBiDiRow(ctx, {
          label: ex.label,
          amountStr: sign + formatMinorMoney(ex.computedMinor, currency, lang),
          xLeft,
          xRight,
          y,
          isRtl,
          labelColor: palette.textSecondary,
          amountColor: ex.computedMinor < 0 ? palette.success : palette.textSecondary,
          labelFont: `500 24px ${fontSans}`,
          amountFont: `600 24px ${fontMono}`,
        });
        y += 44;
      }
    }

    // Grand Total Pill
    y += 16;
    drawRoundedRect(ctx, xLeft, y - 34, xRight - xLeft, 72, 20);
    ctx.fillStyle = palette.accentSoft;
    ctx.fill();
    drawBiDiRow(ctx, {
      label: isRtl ? 'إجمالي الفاتورة' : 'Total Bill',
      amountStr: formatMinorMoney(computation.computedTotalMinor, currency, lang),
      xLeft: xLeft + 24,
      xRight: xRight - 24,
      y: y + 10,
      isRtl,
      labelColor: palette.textPrimary,
      amountColor: palette.accent,
      labelFont: `800 28px ${fontSans}`,
      amountFont: `800 32px ${fontMono}`,
    });
    y += 88;

    // People shares
    ctx.save();
    ctx.font = `700 24px ${fontSans}`;
    ctx.fillStyle = palette.accent;
    ctx.direction = isRtl ? 'rtl' : 'ltr';
    ctx.textAlign = isRtl ? 'right' : 'left';
    ctx.fillText(isRtl ? 'نصيب كل شخص' : 'PER PERSON', isRtl ? xRight : xLeft, y);
    ctx.restore();
    y += 42;

    for (const p of targetPeople) {
      const share = computation.finalPersonTotalsMinor[p.id] || 0;
      drawRoundedRect(ctx, xLeft, y - 32, xRight - xLeft, 56, 16);
      ctx.fillStyle = palette.cardInner;
      ctx.fill();

      const statusTxt = p.paidFlag ? (isRtl ? ' ✓ مدفوع' : ' ✓ Paid') : '';
      drawBiDiRow(ctx, {
        label: `${p.avatar || '👤'} ${p.name}${statusTxt}`,
        amountStr: formatMinorMoney(share, currency, lang),
        xLeft: xLeft + 20,
        xRight: xRight - 20,
        y: y + 4,
        isRtl,
        labelColor: p.paidFlag ? palette.success : palette.textPrimary,
        amountColor: palette.textPrimary,
        labelFont: `700 25px ${fontSans}`,
        amountFont: `800 26px ${fontMono}`,
      });
      y += 68;
    }
  } else {
    // Specific people detailed breakdown
    for (const p of targetPeople) {
      const share = computation.finalPersonTotalsMinor[p.id] || 0;
      drawRoundedRect(ctx, xLeft, y - 32, xRight - xLeft, 64, 18);
      ctx.fillStyle = palette.accentSoft;
      ctx.fill();

      drawBiDiRow(ctx, {
        label: `${p.avatar || '👤'} ${p.name}`,
        amountStr: formatMinorMoney(share, currency, lang),
        xLeft: xLeft + 20,
        xRight: xRight - 20,
        y: y + 10,
        isRtl,
        labelColor: palette.textPrimary,
        amountColor: palette.accent,
        labelFont: `800 28px ${fontSans}`,
        amountFont: `800 30px ${fontMono}`,
      });
      y += 66;

      const breakdown = computation.allocation.perPersonBreakdown[p.id] || [];
      for (const line of breakdown) {
        drawBiDiRow(ctx, {
          label: `${line.name} (×${line.qtyShare})`,
          amountStr: formatMinorMoney(line.shareMinor, currency, lang),
          xLeft: xLeft + 16,
          xRight: xRight - 16,
          y,
          isRtl,
          labelColor: palette.textPrimary,
          amountColor: palette.textSecondary,
          labelFont: `500 24px ${fontSans}`,
          amountFont: `600 24px ${fontMono}`,
        });
        y += 44;
      }

      const pExtra = computation.extras.perPersonExtrasMinor[p.id] || 0;
      if (pExtra !== 0) {
        drawBiDiRow(ctx, {
          label: isRtl ? 'الضريبة والخدمة والإضافات' : 'Tax, Service & Extras',
          amountStr: (pExtra > 0 ? '+' : '') + formatMinorMoney(pExtra, currency, lang),
          xLeft: xLeft + 16,
          xRight: xRight - 16,
          y,
          isRtl,
          labelColor: palette.textSecondary,
          amountColor: palette.textSecondary,
          labelFont: `500 24px ${fontSans}`,
          amountFont: `600 24px ${fontMono}`,
        });
        y += 44;
      }

      const rDelta = computation.rounding.perPersonRoundingDeltaMinor[p.id] || 0;
      if (rDelta !== 0) {
        drawBiDiRow(ctx, {
          label: isRtl ? 'فرق التقريب' : 'Rounding adjustment',
          amountStr: (rDelta > 0 ? '+' : '') + formatMinorMoney(rDelta, currency, lang),
          xLeft: xLeft + 16,
          xRight: xRight - 16,
          y,
          isRtl,
          labelColor: palette.textSecondary,
          amountColor: palette.textSecondary,
          labelFont: `500 22px ${fontSans}`,
          amountFont: `600 22px ${fontMono}`,
        });
        y += 42;
      }
      y += 22;
    }
  }

  // Payment info footer
  if (paymentLines.length > 0) {
    y += 8;
    drawRoundedRect(ctx, xLeft, y - 28, xRight - xLeft, paymentLines.length * 42 + 34, 20);
    ctx.fillStyle = palette.cardInner;
    ctx.fill();
    for (let i = 0; i < paymentLines.length; i++) {
      ctx.save();
      ctx.font = `${i === 0 ? '700' : '500'} 23px ${fontSans}`;
      ctx.fillStyle = i === 0 ? palette.accent : palette.textPrimary;
      ctx.direction = isRtl ? 'rtl' : 'ltr';
      ctx.textAlign = isRtl ? 'right' : 'left';
      ctx.fillText(paymentLines[i], isRtl ? xRight - 20 : xLeft + 20, y + 6, xRight - xLeft - 40);
      ctx.restore();
      y += 42;
    }
    y += 24;
  }

  // Trim exact canvas height cleanly
  const finalHeight = Math.min(estimatedHeight, Math.max(540, y + 96));
  if (finalHeight < estimatedHeight) {
    const trimmed = document.createElement('canvas');
    trimmed.width = width;
    trimmed.height = finalHeight;
    const tCtx = trimmed.getContext('2d')!;
    tCtx.fillStyle = palette.bg;
    tCtx.fillRect(0, 0, width, finalHeight);
    tCtx.drawImage(canvas, 0, 0, width, finalHeight - 48, 0, 0, width, finalHeight - 48);
    // Redraw clean bottom card border
    tCtx.fillStyle = palette.bg;
    tCtx.fillRect(0, finalHeight - 60, width, 60);
    drawRoundedRect(tCtx, padX, 48, width - padX * 2, finalHeight - 96, 36);
    tCtx.strokeStyle = palette.border;
    tCtx.lineWidth = 2;
    tCtx.stroke();
    drawFooterMark(tCtx, width / 2, finalHeight - 66, fontSans, palette.textSecondary, isRtl);
    return trimmed;
  }

  drawFooterMark(ctx, width / 2, finalHeight - 66, fontSans, palette.textSecondary, isRtl);
  return canvas;
}

function isArText(lang: 'ar' | 'en'): boolean {
  return lang === 'ar';
}

function drawFooterMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  fontSans: string,
  color: string,
  isRtl: boolean
): void {
  ctx.save();
  ctx.font = `600 20px ${fontSans}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.direction = isRtl ? 'rtl' : 'ltr';
  ctx.fillText(isRtl ? 'تم الإنشاء عبر solv' : 'Generated by solv', cx, y);
  ctx.restore();
}

export async function exportBillReceiptPngBlob(
  session: BillSession,
  computation: BillComputation,
  options: {
    scope?: ShareScope;
    selectedPersonIds?: string[];
    lang?: 'ar' | 'en';
    theme?: ReceiptImageTheme;
    feeSettings?: Partial<TransferFeeSettings> | null;
  } = {}
): Promise<Blob> {
  const canvas = await renderBillReceiptCanvas(session, computation, options);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export receipt PNG'));
    }, 'image/png');
  });
}

export async function shareOrDownloadReceiptImage(
  blob: Blob,
  fileName: string,
  title: string,
  text?: string
): Promise<'shared' | 'downloaded'> {
  const safeName = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
  const file = new File([blob], safeName, { type: 'image/png' });
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;

  if (nav?.canShare?.({ files: [file] }) && nav?.share) {
    try {
      await nav.share({ files: [file], title, text });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'shared';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

export async function shareTextExternal(text: string, title: string): Promise<boolean> {
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  if (nav?.share) {
    try {
      await nav.share({ title, text });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function copyReceiptImageToClipboard(blob: Blob): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== 'function' ||
    typeof ClipboardItem === 'undefined'
  ) {
    return false;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
