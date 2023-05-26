function debounce (fn, delay = 500) {
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

function convertRating(imageRating) {
  const ratingRatio = 1 / 6;

  const conversion = Number(
    Math.round(imageRating % ratingRatio / ratingRatio) === 0 ?
    10 * (imageRating - (imageRating % ratingRatio)) :
    10 * (imageRating + (ratingRatio - imageRating % ratingRatio))
  );

  return Number(Number(conversion / 10).toFixed(2));
}

document.addEventListener('lazyloaded', function(e){
  if (e.target.getAttribute('src') === '') {
    return;
  }

  e.target.parentNode.classList.add('loaded');
});

class Pagination extends HTMLElement {
  constructor() {
    super();

    this.paginationAmount = Number(this.dataset.paginationAmount);
    this.paginationTypeControls = this.querySelectorAll('.pagination-controls input');
    this.paginationNavContainer = this.querySelector('.pagination-nav');
    this.currentURL = new URL(window.location.href);
    this.currentPage = Number(this.currentURL.searchParams.get('page'));
    this.gridItems = this.querySelectorAll('.grid-item');
    this.imageElems = this.querySelectorAll('img');
    this.activeTags = this.currentURL.searchParams.get('tags') ? this.currentURL.searchParams.get('tags').split(',') : [];
    this.rawData = this.querySelector('script[type="application/json"]') ? JSON.parse(this.querySelector('script[type="application/json"]').innerText) : [];
    this.jsonData = null;

    if (this.nodeName !== 'PAGINATION-COMPONENT') {
      return;
    }

    if (this.activeTags.length > 0) {
      this.getFilteredData().then((data) => {
        this.jsonData = data;
        this.render(this.jsonData);

        document.dispatchEvent(new CustomEvent('data:set', { detail: { instance: this } }));
      });
    } else {
      this.jsonData = this.rawData;
      document.dispatchEvent(new CustomEvent('data:set', { detail: { instance: this } }));
    }

    for (const item of this.gridItems) {
      item.addEventListener('click', () => {
        const itemImg = item.querySelector('img');
        document.dispatchEvent(new CustomEvent('modal:open', { detail: { imageSrc: itemImg.getAttribute('src'), imageRating: itemImg.dataset.rating, gridItem: item } }));
      });
    }

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

    document.addEventListener('jumpto:changed:debounced', () => {
      this.currentPage = event.detail.pageNumber;
      document.dispatchEvent(new CustomEvent('paginationnav:force:rerender', { detail: { instance: this } }));
    });

    document.addEventListener('filter:tags:changed', () => {
      const action = event.detail.action;
      const tag = event.detail.tag;

      if (action === 'add') {
        this.activeTags.push(tag);
      } else {
        this.activeTags.splice(this.activeTags.indexOf(tag), 1);
      }

      this.currentPage = 1;
      this.updateURL();

      if (this.activeTags.length === 0) {
        this.render();
        this.scrollToTop();
        document.dispatchEvent(new CustomEvent('data:set', { detail: { instance: this } }));
      } else {
        this.getFilteredData().then((filteredData) => {
          this.render(filteredData);
          this.scrollToTop();
          document.dispatchEvent(new CustomEvent('data:set', { detail: { instance: this } }));
        });
      }
    });

    if (this.activeTags.length === 0) {
      this.render();
    }
  }

  connectedCallback() {
    if (this.nodeName !== 'PAGINATION-COMPONENT') {
      return;
    }

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

  unloadCurrentImages() {
    for (const image of this.imageElems) {
      image.src = '';
      image.parentNode.classList.remove('loaded');
      image.classList.add('lazyload');
    }
  }

  updateURL() {
    const tagsQuery = this.activeTags.length > 0 ? `&tags=${ this.activeTags.join(',') }` : '';

    window.history.replaceState({}, '', `${ window.location.pathname }?page=${ this.currentPage }${ tagsQuery }`);

    this.currentURL = new URL(window.location.href);
    document.dispatchEvent(new CustomEvent('pagination:pagenumber:changed', { detail: { instance: this } }));
  }

  render(filteredData = []) {
    const currentPage = this.currentPage;
    const images = filteredData.length > 0 ? 
      filteredData.slice((currentPage - 1) * this.paginationAmount, currentPage * this.paginationAmount) : 
      this.jsonData.slice((currentPage - 1) * this.paginationAmount, currentPage * this.paginationAmount);

    if (filteredData.length > 0) {
      this.jsonData = filteredData;
    }

    for (let i = 0; i < this.gridItems.length; i++) {
      if (i >= images.length) {
        this.gridItems[i].classList.add('empty');
        continue;
      }

      this.gridItems[i].classList.remove('empty');
    }

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
        currentImgElem.setAttribute('data-rating', convertRating(Number(currentImage.rating)));
        currentImgElem.classList.add('lazyload');
      }, 200);

      setTimeout(() => {
        currentImgElem.classList.remove('transitioning');
      }, 400);
    }
  }

  async getFilteredData() {
    const tags = this.activeTags.join(',');

    this.unloadCurrentImages();

    return await fetch(`/getfilteredimages?tags=${ tags }`)
    .then(response => response.json())
    .then(data => {
      for (const item of data) {
        item.image = `/getimage?filename=${ item.image }`;
      }

      return data;
    });
  }
}

window.customElements.define('pagination-component', Pagination);

class PaginationNav extends Pagination {
  constructor() {
    super();

    this.firstInstance = document.querySelector('pagination-nav') === this;

    document.addEventListener('pagination:changed', this.renderRemovePaginationNav.bind(this));
    document.addEventListener('pagination:nav:rerendered', this.rerenderPaginationNav.bind(this));
    document.addEventListener('pagination:pagenumber:changed', this.setActiveButton.bind(this));
    document.addEventListener('paginationnav:force:rerender', this.renderPaginationNav.bind(this));
    document.addEventListener('data:set', this.renderIntially.bind(this));
  }

  renderIntially() {
    this.instance = event.detail.instance;

    if (this.firstInstance) {
      document.dispatchEvent(new CustomEvent('pagination:nav:load'));
    }
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
    this.maxPages = 9999;
    
    this.opener.addEventListener('click', this.toggleControls.bind(this));
    this.plus.addEventListener('click', this.incrementPage.bind(this));
    this.minus.addEventListener('click', this.decrementPage.bind(this));
    this.input.addEventListener('input', this.onInput.bind(this));

    document.addEventListener('jumpto:changed', debounce((event) => { this.handlePageChange(event); }).bind(this));
    document.addEventListener('data:set', this.setMaximum.bind(this));

    this.input.value = this.currentPage;
  }

  setMaximum() {
    const instance = event.detail.instance;
    this.maxPages = Math.ceil(instance.jsonData.length / instance.paginationAmount);
  }

  toggleControls() {
    this.opener.classList.toggle('open');
    this.controls.classList.toggle('hidden');
  }

  incrementPage() {
    this.input.value = Number(this.input.value) + 1 > this.maxPages ? this.maxPages : Number(this.input.value) + 1;
    document.dispatchEvent(new CustomEvent('jumpto:changed', { detail: { instance: this } }));
  }

  decrementPage() {
    this.input.value = Number(this.input.value) > 1 ? Number(this.input.value) - 1 : 1;
    document.dispatchEvent(new CustomEvent('jumpto:changed', { detail: { instance: this } }));
  }

  onInput() {
    document.dispatchEvent(new CustomEvent('jumpto:changed', { detail: { instance: this } }));
  }

  handlePageChange(event) {
    const newPage = Number(this.input.value) > 1 ? Number(this.input.value) : 1;
    this.currentPage = newPage;

    if (event.detail.instance === this) {
      const jumpToPageInputs = document.querySelectorAll('jump-to-page input');

      for (const input of jumpToPageInputs) {
        if (input !== this.input) {
          input.value = newPage;
        }
      }

      this.updatePage(newPage);
    }

    document.dispatchEvent(new CustomEvent('jumpto:changed:debounced', { detail: { pageNumber: newPage } }));
  }

  updatePage(newPage) {
    document.dispatchEvent(new CustomEvent('pagination:force:rerender', { detail: { pageNumber: newPage } }));
    this.scrollToTop();
    this.updateURL();
  }
}

window.customElements.define('jump-to-page', JumpToPage);

class ViewModal extends HTMLElement {
  constructor() {
    super();
    
    this.imageContainer = this.querySelector('.view-modal__image-container');
    this.image = this.imageContainer.querySelector('img');
    this.filenameContainer = this.querySelector('.view-modal__filename p');
    this.tagsContainer = this.querySelector('.view-modal__tags');
    this.ratingControls = this.querySelectorAll('input[type="radio"]');
    this.closeButton = this.querySelector('[data-action="close-modal"]');
    this.pageWrapper = document.querySelector('.page-wrapper');
    this.gridItem = null;

    this.closeButton.addEventListener('click', this.closeModal.bind(this));

    document.addEventListener('modal:open', this.openModal.bind(this));

    for (const ratingControl of this.ratingControls) {
      ratingControl.addEventListener('change', this.sendRatingChangedEvent.bind(this));
    }

    document.addEventListener('rating:changed', debounce((event) => { this.handleRatingChange(event); }, 1000).bind(this));
  }

  openModal() {
    this.gridItem = event.detail.gridItem;

    const imageSrc = event.detail.imageSrc;
    const imageRating = Number(event.detail.imageRating) || 0;
    const convertedRating = convertRating(imageRating);

    for (const control of this.ratingControls) {
      if (control.value === convertedRating.toString()) {
        control.checked = true;
      } else {
        control.checked = false;
      }
    }

    this.image.src = imageSrc;

    const tempImg = new Image();
    tempImg.src = imageSrc;

    tempImg.onload = async function () {
      const width = tempImg.width;
      const height = tempImg.height;
      const aspectRatio = height / width;
      const maxViewportHeight = Math.round(window.innerHeight * 0.8);

      if (aspectRatio > 1) {
        this.imageContainer.style.maxWidth = (maxViewportHeight / aspectRatio) + 'px';
        this.image.style.maxHeight = maxViewportHeight + 'px';
      } else {
        this.imageContainer.style.maxWidth = 'unset';
        this.image.style.maxHeight = 'unset';
      }

      const filename = imageSrc.split('=')[1];
      const tags = await fetch('/gettags?filename=' + filename, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(function (response) {
        return response.json();
      }).then(function (data) {
        return data.tags;
      });

      this.filenameContainer.innerText = filename;

      const UrlActiveTags = new URL(window.location.href).searchParams.get('tags') || '';
      const activeTags = UrlActiveTags.split(',');

      let tagsHtml = '';
      for (const tag of tags) {
        const tagElem = document.createElement('image-tag');
        const isActiveTag = activeTags.includes(tag);
        tagElem.innerText = tag;
        tagElem.classList.add('tag');

        if (isActiveTag) {
          tagElem.classList.add('active');
        }

        tagsHtml += tagElem.outerHTML;
      }

      this.tagsContainer.innerHTML = tagsHtml;

      this.image.style.setProperty('aspect-ratio', aspectRatio);
      this.pageWrapper.classList.add('blurred');
      document.documentElement.classList.add('overflow-hidden');
      this.classList.remove('hidden');
    }.bind(this);
  }

  closeModal() {
    this.pageWrapper.classList.remove('blurred');
    document.documentElement.classList.remove('overflow-hidden');
    this.classList.add('hidden');
  }

  sendRatingChangedEvent() {
    document.dispatchEvent(new CustomEvent('rating:changed', { detail: { rating: event.target.value } }));
  }

  handleRatingChange(event) {
    const rating = event.detail.rating;
    const filename = this.filenameContainer.innerText;

    fetch('/updaterating', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: filename,
        rating: rating
      })
    }).then(function (response) {
      return response.json();
    }).then(function (data) {
      if (data.success === true) {
        this.gridItem.querySelector('img').dataset.rating = rating;

        document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'success', message: 'Rating updated' } }));
      } else {
        document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: 'Rating update failed' } }));
      }
    }.bind(this));
  }
}

window.customElements.define('view-modal', ViewModal);

class ToastMessage extends HTMLElement {
  constructor() {
    super();

    this.messageContainer = this.querySelector('.content');
    this.type = this.dataset.type;

    document.addEventListener('toast:show', this.showToast.bind(this));
  }

  showToast() {
    if (this.type !== event.detail.type) {
      return;
    }

    if (document.querySelector(`toast-message[type="${ this.type }"].open`) !== null) {
      return;
    }

    const message = event.detail.message;

    this.messageContainer.innerText = message;
    this.classList.add('open');

    setTimeout(() => {
      this.classList.remove('open');
    }, 3000);
  }
}

window.customElements.define('toast-message', ToastMessage);

class ImageTag extends HTMLElement {
  constructor() {
    super();

    this.active = this.classList.contains('active');

    this.addEventListener('click', this.handleTagClick.bind(this));
  }

  handleTagClick() {
    const currentTag = this.innerText;

    if (this.active) {
      this.classList.remove('active');
      this.active = false;
      document.dispatchEvent(new CustomEvent('filter:tags:changed', { detail: { action: 'remove', tag: currentTag } }));
    } else {
      this.classList.add('active');
      this.active = true;
      document.dispatchEvent(new CustomEvent('filter:tags:changed', { detail: { action: 'add', tag: currentTag } }));
    }
  }
}

window.customElements.define('image-tag', ImageTag);