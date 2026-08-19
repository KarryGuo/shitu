/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* 新视觉系统：国道绿 / 柏油黑 / 标线黄 / 混凝土灰 */
        asphalt: { DEFAULT: '#1B1F24', 2: '#242930', 3: '#2E343D' },
        hwy: { DEFAULT: '#0D7A4F', deep: '#0A5F3C', bright: '#12A268', tint: '#E9F4EE' },
        mark: { DEFAULT: '#FFC72C', deep: '#D9A400' },
        concrete: { DEFAULT: '#F2F1EC', 2: '#E9E8E2' },
        line: '#DBD9D1',
        sub: '#5D646D',
        faint: '#989FA8',
        green: '#0D7A4F',
        led: '#3FE081',
        plateref: '#3F6FB5',
        /* 兼容旧类名 → 映射新色 */
        ink: { DEFAULT: '#1B1F24', 2: '#242930', 3: '#2E343D' },
        paper: { DEFAULT: '#F2F1EC', 2: '#E9E8E2' },
        bronze: { DEFAULT: '#0D7A4F', deep: '#0A5F3C', bg: '#E9F4EE' },
      },
      fontFamily: {
        sign: ['"ZCOOL QingKe HuangYou"', '"Noto Sans SC"', 'sans-serif'],
        num: ['"Barlow Condensed"', '"Noto Sans SC"', 'sans-serif'],
        sans: ['"Noto Sans SC"', '"Microsoft YaHei"', 'sans-serif'],
        serif: ['"ZCOOL QingKe HuangYou"', '"Noto Sans SC"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 #DBD9D1',
        lift: '0 14px 28px -18px rgba(27,31,36,.45)',
        plate: '0 10px 24px -14px rgba(10,95,60,.55)',
      },
    },
  },
  plugins: [],
}
