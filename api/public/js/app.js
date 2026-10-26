/**
 * CRISPY HOUSE — Client-side UI & Motion Orchestrator
 * TUÂN THỦ NGHIÊM NGẶT: Không sử dụng fetch, không sử dụng AJAX.
 * Chuyển trang và nạp dữ liệu hoàn toàn bằng SSR thuần và điều hướng chuẩn.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initPageSlideTransition();
    initNavIndicator();
    initDetailGallery();
    initFileUploadPreviews();
  });

  /* ==========================================================================
     1. Hiệu ứng chuyển động slide toàn bộ trang từ trái sang phải sau khi nạp xong trang
     "thêm hiệu ứng chuyển động slide toàn bộ trang từ trái sang phải sau khi nạp xong trang"
     ========================================================================== */
  function initPageSlideTransition() {
    document.body.classList.add('page-slide-in');

    setTimeout(function () {
      document.body.classList.remove('page-slide-in');
      document.body.classList.add('page-ready');
    }, 600);
  }

  /* ==========================================================================
     2. Thanh chỉ mục (Indicator) trượt êm ái trên thanh điều hướng
     ========================================================================== */
  function initNavIndicator() {
    var navs = document.querySelectorAll('[data-nav]');
    navs.forEach(function (nav) {
      var indicator = nav.querySelector('.nav-indicator');
      var links = nav.querySelectorAll('a[data-tab]');
      var activeLink = nav.querySelector('a[aria-current="page"]');

      function update(link) {
        if (!indicator || !link) return;
        var navRect = nav.getBoundingClientRect();
        var linkRect = link.getBoundingClientRect();
        indicator.style.left = (linkRect.left - navRect.left) + 'px';
        indicator.style.width = linkRect.width + 'px';
        indicator.classList.add('is-ready');
      }

      if (activeLink) {
        requestAnimationFrame(function () {
          update(activeLink);
        });
      }

      links.forEach(function (link) {
        link.addEventListener('mouseenter', function () { update(link); });
        link.addEventListener('focus', function () { update(link); });
      });

      nav.addEventListener('mouseleave', function () {
        if (activeLink) update(activeLink);
      });

      window.addEventListener('resize', function () {
        if (activeLink) update(activeLink);
      });
    });
  }

  /* ==========================================================================
     3. Thư viện hình ảnh ở trang chi tiết món ăn (Click đổi ảnh chính)
     ========================================================================== */
  function initDetailGallery() {
    var mainImg = document.getElementById('detail-main-img');
    var thumbBtns = document.querySelectorAll('.thumb-btn');

    if (!mainImg || thumbBtns.length === 0) return;

    thumbBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var newSrc = btn.getAttribute('data-img-src');
        if (!newSrc || mainImg.src === newSrc) return;

        thumbBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        btn.setAttribute('aria-pressed', 'true');

        mainImg.classList.add('is-swapping');
        setTimeout(function () {
          mainImg.src = newSrc;
          mainImg.classList.remove('is-swapping');
        }, 180);
      });
    });
  }

  /* ==========================================================================
     4. Xem trước file tải lên trong các form Quản lý (Hoàn toàn bằng FileReader, KHÔNG fetch)
     ========================================================================== */
  function initFileUploadPreviews() {
    var dropzones = document.querySelectorAll('.dropzone');

    dropzones.forEach(function (zone) {
      var input = zone.querySelector('input[type="file"]');
      var previewContainer = zone.querySelector('.dropzone-previews');
      if (!input) return;

      input.addEventListener('change', function () {
        if (!previewContainer) return;
        previewContainer.innerHTML = '';
        var files = input.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(function (file) {
          if (!file.type.startsWith('image/')) return;
          var reader = new FileReader();
          reader.onload = function (e) {
            var img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;
            previewContainer.appendChild(img);
          };
          reader.readAsDataURL(file);
        });
      });
    });
  }

})();
