import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';

export default function HomePage() {
  useEffect(() => {
    document.title = 'CRISPY HOUSE';
  }, []);

  return (
    <div className="overflow-hidden">
      {/* Hero Section (Tối giản, hiện đại, giữ nguyên phong cách và bố cục) */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center py-12 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Typography & Call to Action */}
            <div className="lg:col-span-7 space-y-8 z-10">
              <h1 className="hero-title text-4xl sm:text-6xl xl:text-7xl font-black text-cream leading-[1.05] tracking-tight">
                Fast Food <span className="block text-gradient">For You</span>
              </h1>

              <p className="text-sand text-base sm:text-lg max-w-xl leading-relaxed font-normal">
                Từng chiếc đùi và cánh gà được tuyển chọn tươi mới, tẩm ướp gia vị đậm đà và chiên giòn theo tiêu chuẩn nhiệt độ vàng để giữ trọn vị ngọt mọng nước bên trong.
              </p>

              {/* Action button: Xem thực đơn */}
              <div className="pt-2">
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
