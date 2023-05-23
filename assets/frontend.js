function debounce (fn, delay = 250) {
  var timer;
  var pendingPromise;
  var context;
  var args;

  return function debouncedFn () {
    context = this;
    args = arguments;

    clearTimeout(timer);

    if (pendingPromise) {
      pendingPromise.resolve();
    }

    pendingPromise = {
      promise: new Promise(function (resolve, reject) {
        timer = setTimeout(function () {
          try {
            resolve(fn.apply(context, args));
          } catch (error) {
            reject(error);
          }
        }, delay);
      }),
      resolve: function () {
        clearTimeout(timer);

        pendingPromise = null;
      }
    };

    return pendingPromise.promise;
  };
}

document.addEventListener('lazyloaded', function(e){
  e.target.parentNode.classList.add('loaded');
});

class Pagination extends HTMLElement {
  constructor() {
    super();

    this.jsonData = this.querySelector('script[type="application/json"]') ? JSON.parse(this.querySelector('script[type="application/json"]').innerText) : [];
    this.paginationAmount = Number(this.dataset.paginationAmount);
    this.paginationTypeControls = this.querySelectorAll('.pagination-controls input');
    this.paginationNavContainer = this.querySelector('.pagination-nav');
    this.currentURL = new URL(window.location.href);
    this.currentPage = Number(this.currentURL.searchParams.get('page'));
    this.imageElems = this.querySelectorAll('img');

    if (!this.currentPage) {
      this.currentPage = 1;
      window.history.replaceState({}, '', `${ window.location.pathname }?page=${ this.currentPage }`);
    }

    for (const control of this.paginationTypeControls) {
      control.addEventListener('change', () => {
        document.dispatchEvent(new CustomEvent('pagination:changed', { detail: { instance: this } }));

        this.render();
      });
    }

    document.addEventListener('pagination:force:rerender', () => {
      this.currentPage = event.detail.pageNumber;
      this.render();
    });

    this.render();
  }

  connectedCallback() {
    document.addEventListener('pagination:nav:load', () => {
      document.dispatchEvent(new CustomEvent('pagination:changed', { detail: { instance: this } }));
    });
  }

  get paginationType() {
    return this.querySelector('.pagination-controls input:checked') ? this.querySelector('.pagination-controls input:checked').value : null;
  }

  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  updateURL() {
    window.history.replaceState({}, '', `${ window.location.pathname }?page=${ this.currentPage }`);
    document.dispatchEvent(new CustomEvent('pagination:pagenumber:changed', { detail: { instance: this } }));
  }

  render() {
    const currentPage = this.currentPage;
    const images = this.jsonData.slice((currentPage - 1) * this.paginationAmount, currentPage * this.paginationAmount);

    for (let i = 0; i < this.imageElems.length; i++) {
      const currentImage = images[i];

      if (!currentImage) {
        continue;
      }
    }

    for (let i = 0; i < this.imageElems.length; i++) {
      const currentImage = images[i];
      const currentImgElem = this.imageElems[i];

      if (!currentImage) {
        currentImgElem.classList.add('hidden');
        continue;
      }

      currentImgElem.classList.remove('hidden');
      currentImgElem.classList.add('transitioning');
      currentImgElem.parentNode.classList.remove('loaded');

      setTimeout(() => {
        currentImgElem.src = currentImage.image;
        currentImgElem.classList.add('lazyload');
      }, 200);

      setTimeout(() => {
        currentImgElem.classList.remove('transitioning');
      }, 400);
    }
  }
}

window.customElements.define('pagination-component', Pagination);

class PaginationNav extends Pagination {
  constructor() {
    super();

    document.addEventListener('pagination:changed', this.renderRemovePaginationNav.bind(this));
    document.addEventListener('pagination:nav:rerendered', this.rerenderPaginationNav.bind(this));
    document.addEventListener('pagination:pagenumber:changed', this.setActiveButton.bind(this));
  }

  connectedCallback() {
    document.dispatchEvent(new CustomEvent('pagination:nav:load'));
  }

  renderRemovePaginationNav() {
    this.instance = event.detail.instance;

    if (this.instance.paginationType === 'pagination') {
      this.querySelector('jump-to-page').classList.remove('hidden');
      this.renderPaginationNav();
    } else {
      this.querySelector('jump-to-page').classList.add('hidden');
      this.querySelector('.pagination-nav').innerHTML = '';
    }
  }

  rerenderPaginationNav() {
    if (event.target !== this) {
      this.instance = event.detail.instance;
      this.renderPaginationNav(true);
    }
  }

  setActiveButton() {
    const currentPage = this.instance.currentPage;
    const navLinks = this.querySelectorAll('a');

    for (const link of navLinks) {
      link.classList.remove('active');

      if (link.innerText === currentPage.toString()) {
        link.classList.add('active');
      }
    }
  }

  addNavEventListeners() {
    const navLinks = this.querySelectorAll('a');

    for (const link of navLinks) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = e.target.innerText;

        if (targetPage.includes('Previous')) {
          this.instance.currentPage = Number(this.instance.currentPage) - 1;
        } else if (targetPage.includes('Next')) {
          this.instance.currentPage = Number(this.instance.currentPage) + 1;
        } else {
          this.instance.currentPage = Number(targetPage);
        }

        this.instance.render();
        this.instance.scrollToTop();
        this.instance.updateURL();
        this.renderPaginationNav();
      });
    }
  }

  renderPaginationNav(outsideCall = false) {
    const currentPage = this.instance.currentPage;
    const pagesAmount = Math.ceil(this.instance.jsonData.length / this.instance.paginationAmount);
    const isNextNav = currentPage < pagesAmount;
    const isPrevNav = currentPage > 1;
    const navElem = document.createElement('nav');
    const neighbourPages = 2;

    let prevElem = null;
    let nextElem = null;
    let inbetweenElems = [];

    if (isPrevNav) {
      prevElem = document.createElement('a');
      prevElem.href = `?page=${ Number(currentPage) - 1 }`;
      prevElem.innerText = '< Previous';
      prevElem.classList.add('prev');
    }

    if (isNextNav) {
      nextElem = document.createElement('a');
      nextElem.href = `?page=${ Number(currentPage) + 1 }`;
      nextElem.innerText = 'Next >';
      nextElem.classList.add('next');
    }

    const lowerBound = currentPage - neighbourPages > 0 ? currentPage - neighbourPages : 1;
    const upperBound = currentPage + neighbourPages < pagesAmount ? currentPage + neighbourPages : pagesAmount;

    for (let i = lowerBound; i <= upperBound; i++) {
      const elem = document.createElement('a');
      elem.href = `?page=${ i }`;
      elem.innerText = i;

      if (i === currentPage) {
        elem.classList.add('active');
      }

      inbetweenElems.push(elem);
    }

    if (prevElem) {
      navElem.appendChild(prevElem);
    }

    for (const elem of inbetweenElems) {
      navElem.appendChild(elem);
    }

    if (nextElem) {
      navElem.appendChild(nextElem);
    }

    this.querySelector('.pagination-nav').innerHTML = navElem.innerHTML;
    this.addNavEventListeners();

    if (!outsideCall) {
      document.dispatchEvent(new CustomEvent('pagination:nav:rerendered', { detail: { instance: this.instance } }));
    }
  }
}

window.customElements.define('pagination-nav', PaginationNav);

class JumpToPage extends Pagination {
  constructor() {
    super();

    this.opener = this.querySelector('[data-action="open-controls"]');
    this.controls = this.querySelector('.jump-to-page__controls');
    this.input = this.querySelector('input');
    this.plus = this.querySelector('[data-action="add"]');
    this.minus = this.querySelector('[data-action="subtract"]');
    
    this.opener.addEventListener('click', this.toggleControls.bind(this));
    this.plus.addEventListener('click', debounce(() => { this.incrementPage(); }).bind(this));
    this.minus.addEventListener('click', debounce(() => { this.decrementPage(); }).bind(this));
    this.input.addEventListener('input', debounce(() => { this.onInput(); }).bind(this));

    this.input.value = this.currentPage;
  }

  toggleControls() {
    this.controls.classList.toggle('hidden');
  }

  incrementPage() {
    this.input.value = Number(this.input.value) + 1;
    this.updatePage();
  }

  decrementPage() {
    this.input.value = Number(this.input.value) > 1 ? Number(this.input.value) - 1 : 1;
    this.updatePage();
  }

  onInput() {
    this.input.value = Number(this.input.value) > 1 ? Number(this.input.value) : 1;
    this.updatePage();
  }

  updatePage() {
    document.dispatchEvent(new CustomEvent('pagination:force:rerender', { detail: { pageNumber: Number(this.input.value) } }));
    this.scrollToTop();
    this.updateURL();
  }
}

window.customElements.define('jump-to-page', JumpToPage);