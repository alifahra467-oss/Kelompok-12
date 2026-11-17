import React from 'react';

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasArabicText(text: string): boolean {
  return ARABIC_REGEX.test(text);
}

export function isPredominantlyArabic(text: string): boolean {
  if (!text) return false;
  const arabicMatches = text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || [];
  const latinMatches = text.match(/[a-zA-Z]/g) || [];
  return arabicMatches.length > latinMatches.length;
}

interface ArabicTextProps {
  text: string;
  className?: string;
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3';
}

export const ArabicText: React.FC<ArabicTextProps> = ({ text, className = '', as = 'span' }) => {
  const rtl = isPredominantlyArabic(text);
  const containsArabic = hasArabicText(text);
  const Tag = as;

  if (!containsArabic) {
    return (
      <Tag dir="ltr" className={`text-left ${className}`}>
        {text}
      </Tag>
    );
  }

  if (rtl) {
    return (
      <Tag dir="rtl" lang="ar" className={className}>
        {text}
      </Tag>
    );
  }

  // Mixed Indonesian + Arabic: pertahankan satu font, rata kiri, dan isolasi bidi tanpa mengubah ukuran/tinggi baris
  const segments = text.split(
    /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:\s+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*)/g
  );

  return (
    <Tag dir="ltr" className={`text-left ${className}`}>
      {segments.map((part, idx) =>
        ARABIC_REGEX.test(part) ? (
          <bdi key={idx} dir="rtl" lang="ar">
            {part}
          </bdi>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        )
      )}
    </Tag>
  );
};
