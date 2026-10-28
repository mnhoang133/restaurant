import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import Icon from '../../components/Icon';

gsap.registerPlugin(useGSAP, SplitText);

export default function HomePage() {
  const heroRef = useRef(null);

  useEffect(() => {
    document.title = 'CRISPY HOUSE';
  }, []);

  // Chuỗi hiệu ứng xuất hiện tuần tự cho Hero Banner bằng gsap.timeline() & SplitText
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const targets = ['.hero-title-line', '.hero-cta', '.plate-stage'];

        // Tách tiêu đề phụ thành từng từ và từng chữ cái (giữ nguyên cụm dấu tiếng Việt nhờ Intl.Segmenter)
        const splitDesc = SplitText.create('.hero-desc', {
          type: 'words, chars',
        });

        // Đặt trạng thái khởi đầu: tiêu đề phụ hiện sẵn ở trạng thái mờ (opacity: 0.18)
        gsap.set('.hero-title-line', { autoAlpha: 0, y: 42 });
        gsap.set(splitDesc.chars, { opacity: 0.18 });
        gsap.set('.hero-cta', { autoAlpha: 0, y: 18, scale: 0.84, transformOrigin: 'center center' });
        gsap.set('.plate-stage', { autoAlpha: 0, x: 140, scale: 0.94, rotation: 10 });

        const tl = gsap.timeline({
          defaults: { ease: 'power3.out' },
          onComplete: () => {
            gsap.set(targets, { clearProps: 'all' });
          },
        });

        // Bước 1: Chữ tiêu đề chính xuất hiện trước
        tl.addLabel('title', 0)
          .to(
            '.hero-title-line',
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.62,
              stagger: 0.12,
            },
            'title'
          )
          // Bước 2: Ngay sau khi tiêu đề xuất hiện thì đĩa gà trượt mượt từ phải sang
          .addLabel('plate', '>-0.1')
          .to(
            '.plate-stage',
            {
              autoAlpha: 1,
              x: 0,
              scale: 1,
              rotation: 0,
              duration: 0.82,
              ease: 'power3.out',
            },
            'plate'
          )
          // Bước 3: Tiêu đề phụ (ban đầu mờ) đậm rõ dần lên theo đúng thứ tự từng chữ cái
          .addLabel('subtitle', 'plate+=0.22')
          .to(
            splitDesc.chars,
            {
              opacity: 1,
              duration: 0.24,
              stagger: 0.013,
              ease: 'power1.out',
            },
            'subtitle'
          )
          // Bước 4: Nút CTA xuất hiện và nảy nhẹ (spring bounce)
          .addLabel('cta', 'plate+=0.62')
          .to(
            '.hero-cta',
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.52,
              ease: 'back.out(2.2)',
            },
            'cta'
          );
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(['.hero-title-line', '.hero-desc', '.hero-cta', '.plate-stage'], {
          clearProps: 'all',
        });
      });
    },
    { scope: heroRef }
  );

  return (
    <div ref={heroRef} className="overflow-hidden">
      {/* Hero Section (Tối giản, hiện đại, giữ nguyên phong cách và bố cục) */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center py-12 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Typography & Call to Action */}
            <div className="lg:col-span-7 space-y-8 z-10">
              <h1 className="hero-title text-4xl sm:text-6xl xl:text-7xl font-black text-cream leading-[1.05] tracking-tight">
                <span className="hero-title-line block">Fast Food</span>
                <span className="hero-title-line block text-gradient">For You</span>
              </h1>

              <p
                style={{ fontKerning: 'none' }}
                className="hero-desc text-cream/80 text-base sm:text-lg max-w-xl leading-relaxed font-medium"
              >
                Từng chiếc đùi và cánh gà được tuyển chọn tươi mới, tẩm ướp gia vị đậm đà và chiên giòn theo tiêu chuẩn nhiệt độ vàng để giữ trọn vị ngọt mọng nước bên trong.
              </p>

              {/* Action button: Xem thực đơn (bọc trong .hero-cta để không xung đột CSS transition của .btn) */}
              <div className="pt-2">
                <div className="hero-cta inline-block w-full sm:w-auto">
                  <Link
                    to="/dishes"
                    className="btn btn-primary text-base px-8 h-12 sm:h-14 group shadow-xl shadow-brand/30 w-full sm:w-auto justify-center"
                  >
                    <span>Xem Thực Đơn</span>
                    <span className="btn-arrow w-8 h-8 rounded-full bg-white/20 grid place-items-center transition-transform group-hover:translate-x-1">
                      <Icon name="arrow-right" cls="w-4 h-4" sw={2.2} />
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Fried Chicken Plate */}
            <div className="lg:col-span-5 flex justify-center relative">
              <div className="plate-stage relative w-full max-w-[480px] sm:max-w-[540px] aspect-square">
                {/* Vầng ánh sáng đỏ ấm tinh tế phía sau đĩa */}
                <div className="plate-glow" />

                {/* Đĩa gà rán tròn chụp từ trên xuống */}
                <div id="hero-plate-disc" className="plate-disc">
                  <img
                    src="/images/chicken-plate.png"
                    alt="Đĩa đầy đùi và cánh gà rán vàng giòn rụm"
                    id="hero-plate-img"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
