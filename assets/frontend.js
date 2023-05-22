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
    this.currentPage = this.currentURL.searchParams.get('page');
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

  render() {
    //this.renderRemovePaginationNav();
    const currentPage = this.currentPage;
    const images = this.jsonData.slice((currentPage - 1) * this.paginationAmount, currentPage * this.paginationAmount);

    for (let i = 0; i < this.imageElems.length; i++) {
      const currentImage = images[i];

      if (!currentImage) {
        this.imageElems[i].classList.add('hidden');
        continue;
      }

      this.imageElems[i].classList.remove('hidden');
      this.imageElems[i].src = currentImage.image;
    }
  }
}

window.customElements.define('pagination-component', Pagination);

class PaginationNav extends Pagination {
  constructor() {
    super();

    document.addEventListener('pagination:changed', this.renderRemovePaginationNav.bind(this));
  }

  connectedCallback() {
    document.dispatchEvent(new CustomEvent('pagination:nav:load'));
  }

  renderRemovePaginationNav() {
    this.instance = event.detail.instance;

    if (this.instance.paginationType === 'pagination') {
      this.renderPaginationNav();
    } else {
      this.innerHTML = '';
    }
  }

  addNavEventListeners() {
    const navLinks = this.querySelectorAll('a');

    for (const link of navLinks) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentPage = Number(e.target.innerText);
        this.render();
      });
    }
  }

  renderPaginationNav() {
    const pagesAmount = Math.ceil(this.instance.jsonData.length / this.instance.paginationAmount);
    const isNextNav = this.currentPage < pagesAmount;
    const isPrevNav = this.currentPage > 1;
    const navElem = document.createElement('nav');
    const neighbourPages = 2;

    let prevElem = null;
    let nextElem = null;
    let inbetweenElems = [];

    if (isPrevNav) {
      prevElem = document.createElement('a');
      prevElem.href = `?page=${ Number(this.currentPage) - 1 }`;
      prevElem.innerText = '< Previous';
    }

    if (isNextNav) {
      nextElem = document.createElement('a');
      nextElem.href = `?page=${ Number(this.currentPage) + 1 }`;
      nextElem.innerText = 'Next >';
    }

    const lowerBound = this.currentPage - neighbourPages > 0 ? this.currentPage - neighbourPages : 1;
    const upperBound = this.currentPage + neighbourPages < pagesAmount ? this.currentPage + neighbourPages : pagesAmount;

    for (let i = lowerBound; i <= upperBound; i++) {
      const elem = document.createElement('a');
      elem.href = `?page=${ i }`;
      elem.innerText = i;

      if (i === this.currentPage) {
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

    this.innerHTML = navElem.innerHTML;
    this.addNavEventListeners();
  }
}

window.customElements.define('pagination-nav', PaginationNav);