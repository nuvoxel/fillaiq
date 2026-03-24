"use client";

export type LabelPreviewData = {
  brand?: string;
  brandLogoUrl?: string;
  material?: string;
  color?: string;
  colorName?: string;
  nozzleTemp?: string;
  bedTemp?: string;
  dryingInfo?: string;
  flowRatio?: string;
  td?: string;
  weight?: string;
  location?: string;
  price?: string;
  purchaseDate?: string;
  lotNumber?: string;
  filamentId?: string;
};

export type LabelPreviewSettings = {
  widthMm: number;
  heightMm: number;
  showBrand: boolean;
  showMaterial: boolean;
  showColor: boolean;
  showColorSwatch: boolean;
  showTemps: boolean;
  showDryingInfo: boolean;
  showQrCode: boolean;
  showWeight: boolean;
  showLocation: boolean;
  showPrice: boolean;
  showPurchaseDate: boolean;
  showLotNumber: boolean;
  showFilamentId: boolean;
};

const SAMPLE_DATA: LabelPreviewData = {
  brand: "Bambu Lab",
  brandLogoUrl: undefined,
  material: "PLA Basic",
  color: "#1A1A1A",
  colorName: "Black",
  nozzleTemp: "190\u2013220\u00b0C",
  bedTemp: "50\u201365\u00b0C",
  dryingInfo: "55\u00b0C / 4h",
  flowRatio: "0.96",
  weight: "742g",
  location: "Shelf A-3",
  price: "$18.99",
  purchaseDate: "2026-01-15",
  lotNumber: "BL-2026-0142",
  filamentId: "108",
};

/** Scale factor: 1mm = this many CSS px in the preview */
const PX_PER_MM = 4;

export function LabelPreview({
  settings,
  data = SAMPLE_DATA,
  maxWidth,
}: {
  settings: LabelPreviewSettings;
  data?: LabelPreviewData;
  maxWidth?: number;
}) {
  const naturalW = settings.widthMm * PX_PER_MM;
  const naturalH = settings.heightMm * PX_PER_MM;

  // Scale down to fit container if needed
  const scale =
    maxWidth && naturalW > maxWidth ? maxWidth / naturalW : 1;
  const displayW = naturalW * scale;
  const displayH = naturalH * scale;

  const isLandscape = settings.widthMm >= settings.heightMm;
  const compact = settings.widthMm <= 30 || settings.heightMm <= 30;

  // Determine a readable text color that contrasts with the swatch color
  const swatchColor = data.color ?? "#1A1A1A";

  return (
    <div
      className="relative mx-auto overflow-hidden rounded border border-dashed border-border bg-white"
      style={{ width: displayW, height: displayH }}
    >
      <div
        className="flex flex-col"
        style={{
          width: naturalW,
          height: naturalH,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          padding: compact ? 4 : 12,
          gap: compact ? 2 : 4,
          fontFamily: "'Inter', 'Roboto', sans-serif",
        }}
      >
        {/* Row 1: Brand (logo or text) + Color hex */}
        <div className="flex items-start justify-between">
          {settings.showBrand && (
            data.brandLogoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={data.brandLogoUrl}
                alt={data.brand}
                className="min-w-0 flex-1 object-contain object-left"
                style={{ height: compact ? 14 : 22, maxWidth: "65%" }}
              />
            ) : (
              <span
                className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                style={{
                  fontSize: compact ? 10 : 16,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  color: "#1A2530",
                  letterSpacing: "-0.02em",
                }}
              >
                {data.brand}
              </span>
            )
          )}
          {settings.showColor && data.color && (
            <span
              className="ml-1 shrink-0 font-mono"
              style={{
                fontSize: compact ? 6 : 9,
                fontWeight: 500,
                color: "#94A3B8",
                marginTop: compact ? 2 : 4,
              }}
            >
              {data.color}
            </span>
          )}
        </div>

        {/* Row 2: Material on dark strip */}
        {settings.showMaterial && (
          <div
            className="inline-flex self-start text-white"
            style={{
              backgroundColor: "#0F1F23",
              paddingLeft: compact ? 4 : 8,
              paddingRight: compact ? 4 : 8,
              paddingTop: compact ? 0 : 1.2,
              paddingBottom: compact ? 0 : 1.2,
              marginLeft: compact ? -4 : -12,
              maxWidth: "75%",
            }}
          >
            <span
              className="overflow-hidden text-ellipsis whitespace-nowrap"
              style={{
                fontSize: compact ? 7 : 11,
                fontWeight: 700,
                lineHeight: 1.3,
              }}
            >
              {data.material}
            </span>
          </div>
        )}

        {/* Row 3: Color name */}
        {(settings.showColor && data.colorName) && (
          <span
            style={{
              fontSize: compact ? 8 : 13,
              fontWeight: 600,
              color: "#1A2530",
              lineHeight: 1.2,
            }}
          >
            {data.colorName}
          </span>
        )}

        {/* Bottom section: Info fields + QR code */}
        <div className="mt-auto flex flex-1 items-end">
          {/* Left column: key-value pairs */}
          <div className="min-w-0 flex-1">
            {settings.showTemps && data.nozzleTemp && (
              <InfoRow label="Nozzle:" value={data.nozzleTemp} compact={compact} />
            )}
            {settings.showTemps && data.bedTemp && (
              <InfoRow label="Bed:" value={data.bedTemp} compact={compact} />
            )}
            {settings.showDryingInfo && data.dryingInfo && (
              <InfoRow label="Drying Info:" value={data.dryingInfo} compact={compact} />
            )}
            {data.flowRatio && (
              <InfoRow label="Flow Ratio:" value={data.flowRatio} compact={compact} />
            )}
            {data.td && (
              <InfoRow label="TD:" value={data.td} compact={compact} />
            )}
            {settings.showFilamentId && data.filamentId && (
              <InfoRow label="Filament ID:" value={data.filamentId} compact={compact} />
            )}
            {settings.showWeight && data.weight && (
              <InfoRow label="Weight:" value={data.weight} compact={compact} />
            )}
            {settings.showLocation && data.location && (
              <InfoRow label="Location:" value={data.location} compact={compact} />
            )}
            {settings.showPrice && data.price && (
              <InfoRow label="Price:" value={data.price} compact={compact} />
            )}
            {settings.showLotNumber && data.lotNumber && (
              <InfoRow label="Lot:" value={data.lotNumber} compact={compact} />
            )}
          </div>

          {/* Right: QR code */}
          {settings.showQrCode && (
            <div
              className="ml-1 flex shrink-0 items-center justify-center rounded-sm"
              style={{
                width: compact ? 24 : 44,
                height: compact ? 24 : 44,
                border: "1.5px solid #94A3B8",
                backgroundColor: "#F4F6F8",
              }}
            >
              <span
                className="select-none"
                style={{
                  fontSize: compact ? 6 : 9,
                  fontWeight: 600,
                  color: "#94A3B8",
                }}
              >
                QR
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact: boolean;
}) {
  return (
    <div className="flex" style={{ gap: compact ? 2 : 4, lineHeight: 1 }}>
      <span
        className="whitespace-nowrap"
        style={{
          fontSize: compact ? 6 : 9,
          fontWeight: 500,
          color: "#94A3B8",
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
      <span
        className="whitespace-nowrap"
        style={{
          fontSize: compact ? 6 : 9,
          fontWeight: 600,
          color: "#1A2530",
          lineHeight: 1.4,
        }}
      >
        {value}
      </span>
    </div>
  );
}
