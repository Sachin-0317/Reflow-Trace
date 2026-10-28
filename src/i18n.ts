import { useStore } from './store';

const en: Record<string, string> = {
  'nav.map': 'Map', 'nav.batches': 'Batches', 'nav.discrepancies': 'Discrepancies', 'nav.points': 'Points',
  'nav.network': 'Network', 'nav.evidence': 'Evidence', 'nav.audit': 'Audit', 'nav.qr': 'QR', 'nav.control': 'Control',
  'nav.handoff': 'Handoff', 'nav.scan': 'Scan', 'nav.issues': 'Issues', 'nav.more': 'More',
  'status.verified': 'VERIFIED', 'status.attested': 'ATTESTED', 'status.discrepancy': 'DISCREPANCY',
  'status.pending': 'PENDING', 'status.unknown': 'UNKNOWN',
  'tagline': 'Waste is traceable. People aren’t.',
  'public.title': 'Nothing about you is recorded.',
  'public.line': 'The waste is tracked. You are not.',
  'public.how1': 'This bin has a QR code that holds only a bin ID.',
  'public.how2': 'Staff scan each batch of waste at every handover, never a person.',
  'public.how3': 'No name, phone number, login or cookie is stored here.',
  'public.report': 'Optional: tell staff about the bin',
  'public.full': 'Bin full', 'public.damaged': 'Bin damaged', 'public.supplies': 'Supplies needed',
  'public.sent': 'Sent. Staff will see the bin ID and the type of report, nothing else.',
  'public.limited': 'Already sent a moment ago. Try again in a minute.',
  'hero.label': 'VERIFIED TREATMENT',
};

const ta: Record<string, string> = {
  'nav.map': 'வரைபடம்', 'nav.batches': 'தொகுதிகள்', 'nav.discrepancies': 'முரண்பாடுகள்', 'nav.points': 'இடங்கள்',
  'nav.network': 'வலையமைப்பு', 'nav.evidence': 'ஆதாரம்', 'nav.audit': 'தணிக்கை', 'nav.qr': 'QR', 'nav.control': 'அமைப்புகள்',
  'nav.handoff': 'ஒப்படைப்பு', 'nav.scan': 'ஸ்கேன்', 'nav.issues': 'சிக்கல்கள்', 'nav.more': 'மேலும்',
  'status.verified': 'சரிபார்க்கப்பட்டது', 'status.attested': 'உறுதிசெய்யப்பட்டது', 'status.discrepancy': 'முரண்பாடு',
  'status.pending': 'நிலுவை', 'status.unknown': 'தெரியவில்லை',
  'tagline': 'கழிவு கண்காணிக்கப்படும். மனிதர்கள் அல்ல.',
  'public.title': 'உங்களைப் பற்றி எதுவும் பதிவு செய்யப்படுவதில்லை.',
  'public.line': 'கழிவு கண்காணிக்கப்படுகிறது. நீங்கள் அல்ல.',
  'public.how1': 'இந்த தொட்டியில் உள்ள QR குறியீட்டில் தொட்டியின் ID மட்டுமே உள்ளது.',
  'public.how2': 'ஒவ்வொரு ஒப்படைப்பிலும் ஊழியர்கள் கழிவுத் தொகுதியை ஸ்கேன் செய்கிறார்கள், நபரை அல்ல.',
  'public.how3': 'பெயர், தொலைபேசி எண், உள்நுழைவு அல்லது குக்கீ எதுவும் சேமிக்கப்படுவதில்லை.',
  'public.report': 'விருப்பம்: தொட்டி பற்றி ஊழியர்களுக்குத் தெரிவிக்கவும்',
  'public.full': 'தொட்டி நிறைந்துள்ளது', 'public.damaged': 'தொட்டி சேதமடைந்துள்ளது', 'public.supplies': 'பொருட்கள் தேவை',
  'public.sent': 'அனுப்பப்பட்டது. ஊழியர்களுக்கு தொட்டி ID மற்றும் அறிக்கை வகை மட்டுமே தெரியும்.',
  'public.limited': 'சற்று முன் அனுப்பப்பட்டது. ஒரு நிமிடம் கழித்து முயற்சிக்கவும்.',
  'hero.label': 'சரிபார்க்கப்பட்ட சிகிச்சை',
};

export function useT() {
  const lang = useStore((s) => s.lang);
  return (k: string) => (lang === 'ta' ? ta[k] ?? en[k] ?? k : en[k] ?? k);
}
