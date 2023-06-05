function debounce(fn, delay = 500) {
  var timer;
  var pendingPromise;
  var context;
  var args;

  return function debouncedFn() {
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
  if (imageRating === null || imageRating === -1.0) {
    return null;
  }

  const ratingRatio = 1 / 6;

  const conversion = Number(
    Math.round(imageRating % ratingRatio / ratingRatio) === 0 ?
    10 * (imageRating - (imageRating % ratingRatio)) :
    10 * (imageRating + (ratingRatio - imageRating % ratingRatio))
  );

  return Number(Number(conversion / 10).toFixed(2));
}

function ratingToRank(rating) {
  switch (rating) {
    case 0:
      return 'F';
    case 0.17:
      return 'D';
    case 0.33:
      return 'C';
    case 0.5:
      return 'B';
    case 0.67:
      return 'A';
    case 0.83:
      return 'S';
    case 1:
      return 'SS';
    default:
      return null;
  }
}

function getRankColor(rank) {
  switch (rank) {
    case 'F':
      return {
        rankColor: window.rankColors[6],
        rankColorDark: window.rankColorsDark[6]
      };
    case 'D':
      return {
        rankColor: window.rankColors[5],
        rankColorDark: window.rankColorsDark[5]
      };
    case 'C':
      return {
        rankColor: window.rankColors[4],
        rankColorDark: window.rankColorsDark[4]
      };
    case 'B':
      return {
        rankColor: window.rankColors[3],
        rankColorDark: window.rankColorsDark[3]
      };
    case 'A':
      return {
        rankColor: window.rankColors[2],
        rankColorDark: window.rankColorsDark[2]
      };
    case 'S':
      return {
        rankColor: window.rankColors[1],
        rankColorDark: window.rankColorsDark[1]
      };
    case 'SS':
      return {
        rankColor: window.rankColors[0],
        rankColorDark: window.rankColorsDark[0]
      };
    default:
      return null;
  }
}

function generateRandomFilename(extension = 'jpg') {
  return `${ Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) }.${ extension }`;
}

document.addEventListener('lazyloaded', function (e) {
  if (e.target.getAttribute('src') === '') {
    return;
  }

  e.target.parentNode.classList.add('loaded');
});

class StickyNavigation extends HTMLElement {
  constructor() {
    super();

    this.boundary = 200;
    this.previousPosition = 0;
    this.opener = this.querySelector('[data-action="open-sidemenu"]');
    this.sideMenu = document.querySelector('sidebar-navigation');

    this.opener.addEventListener('click', this.toggleSidemenu.bind(this));
    window.addEventListener('scroll', debounce(function () { this.changeNavStage(); }, 25).bind(this));
  }

  changeNavStage() {
    const currentPosition = window.pageYOffset;

    if (currentPosition > this.previousPosition && currentPosition > this.boundary) {
      this.classList.add('closed');
    } else {
      this.classList.remove('closed');
    }

    this.previousPosition = currentPosition;
  }

  toggleSidemenu() {
    this.classList.toggle('force-open');
    this.sideMenu.classList.toggle('open');
    document.documentElement.classList.toggle('overflow-hidden');
  }
}

window.customElements.define('sticky-navigation', StickyNavigation);

class SidebarNavigation extends HTMLElement {
  constructor() {
    super();

    this.closeButton = this.querySelector('[data-action="close-sidemenu"]');

    this.closeButton.addEventListener('click', this.closeSidemenu.bind(this));

    document.addEventListener('sidemenu:close', this.closeSidemenu.bind(this));
  }

  closeSidemenu() {
    this.classList.remove('open');
    document.querySelector('sticky-navigation').classList.remove('force-open');
    document.documentElement.classList.remove('overflow-hidden');
  }
}

window.customElements.define('sidebar-navigation', SidebarNavigation);

class ImageGrid extends HTMLElement {
  constructor() {
    super();

    this.maxImageCount = 60;
    this.currentPage = 1;
    this.currentTags = [];
    this.currentSort = '';
    this.currentRated = '';
    
    this.gridWrapper = this.querySelector('.grid-wrapper');
    this.gridItems = this.querySelectorAll('.grid-item');
    this.imagesData = [];
    this.emptyContainer = this.querySelector('.empty-container');
    this.navigationControls = this.querySelectorAll('pagination-nav');

    document.addEventListener('imagegrid:params:changed', this.getImagesData.bind(this));
    document.addEventListener('imagegrid:images:loaded', this.onImagesLoaded.bind(this));
    document.addEventListener('page:changed', this.handlePageChange.bind(this));
    document.addEventListener('filter:tags:changed', this.handleFilterChange.bind(this));

    this.getImagesData();

    for (const item of this.gridItems) {
      item.addEventListener('click', function () {
        const itemImg = item.querySelector('img');
        document.dispatchEvent(new CustomEvent('modal:open', { detail: { imageSrc: itemImg.getAttribute('src'), imageRating: item.dataset.rating, gridItem: item } }));
      });
    }
  }

  async getImagesData() {
    const currentUrl = new URL(window.location.href);
    const urlParams = currentUrl.searchParams;

    this.currentPage = urlParams.get('page') !== null ? Number(urlParams.get('page')) : 1;
    this.currentTags = urlParams.get('filters') !== null ? urlParams.get('filters').split(',') : [];
    this.currentSort = urlParams.get('sort') !== null ? urlParams.get('sort') : '';
    this.currentRated = urlParams.get('rated') !== null ? urlParams.get('rated') : '';

    const filtersQuery = this.currentTags.length > 0 ? `&filters=${ this.currentTags.join(',') }` : '';
    const sortQuery = this.currentSort !== '' ? `&sort=${ this.currentSort }` : '';
    const ratedQuery = this.currentRated !== '' ? `&rated=${ this.currentRated }`: '';

    const images = await fetch(`/getimages?&page=${ this.currentPage }${ filtersQuery }${ sortQuery }${ ratedQuery }`);

    if (images.status !== 200) {
      this.imagesData = [];
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: 'Request timed out' } }));
      return;
    }

    const response = await images.json();

    this.imagesData = response.images;

    if (this.imagesData.length === 0) {
      this.gridWrapper.classList.add('empty');
      this.emptyContainer.classList.remove('hidden');

      for (const control of this.navigationControls) {
        control.classList.add('hidden');
      }
    } else {
      this.gridWrapper.classList.remove('empty');
      this.emptyContainer.classList.add('hidden');

      for (const control of this.navigationControls) {
        control.classList.remove('hidden');
      }
    }

    document.dispatchEvent(new CustomEvent('imagegrid:images:loaded'));
    document.dispatchEvent(new CustomEvent('pagination:page:changed', { detail: { currentPage: this.currentPage, maxPages: response.max_page } }));
    document.dispatchEvent(new CustomEvent('jumpto:page:changed', { detail: { newPage: this.currentPage } }));
    document.dispatchEvent(new CustomEvent('jumpto:maximum:changed', { detail: { maxPages: response.max_page } }));
    document.dispatchEvent(new CustomEvent('tagsearch:tags:set', { detail: { tags: this.currentTags } }));
  }

  unloadCurrentImages() {
    for (const gridItem of this.gridItems) {
      const image = gridItem.querySelector('img');
      gridItem.classList.remove('loaded');

      setTimeout(function () {
        image.src = '';
        image.classList.add('lazyload');
      }, 200);
    }
  }

  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  onImagesLoaded() {
    const imageData = this.imagesData;

    for (let i = 0; i < this.gridItems.length; i++) {
      const gridItem = this.gridItems[i];
      const imageElem = gridItem.querySelector('img');

      if (i >= imageData.length || typeof imageData[i] === 'undefined') {
        gridItem.classList.add('empty');
        continue;
      }

      const newImage = `/getimage?filename=${ imageData[i].image }`;
      const newRating = convertRating(imageData[i].rating);
      const newRank = ratingToRank(newRating);
      const newRankColor = getRankColor(newRank);

      gridItem.classList.remove('empty');
      gridItem.classList.remove('loaded');

      imageElem.classList.add('transitioning');

      setTimeout(function () {
        if (newRating !== null) {
          gridItem.setAttribute('data-rating', newRating);
        } else {
          gridItem.removeAttribute('data-rating');
        }

        if (newRank !== null) {
          gridItem.setAttribute('data-rank', newRank);
        } else {
          gridItem.removeAttribute('data-rank');
        }

        if (newRank === null || newRating === null) {
          gridItem.classList.add('not-rated');
        } else {
          gridItem.classList.remove('not-rated');
        }

        gridItem.style.setProperty('--rank-color', newRankColor !== null ? newRankColor.rankColor : 'transparent');
        gridItem.style.setProperty('--rank-color-dark', newRankColor !== null ? newRankColor.rankColorDark : 'transparent');

        imageElem.src = newImage
        imageElem.classList.add('lazyload');

        const tempImage = new Image();
        tempImage.src = newImage;

        tempImage.onload = function() {
          imageElem.classList.remove('transitioning');
        }
      }, 200);
    }
  }

  handlePageChange(event) {
    this.currentPage = typeof event.detail.newPage !== 'undefined' ? event.detail.newPage : this.currentPage;
    this.currentTags = typeof event.detail.newTags !== 'undefined' ? event.detail.newTags : this.currentTags;
    this.currentSort = typeof event.detail.newSort !== 'undefined' ? event.detail.newSort : this.currentSort;
    this.currentRated = typeof event.detail.newRated !== 'undefined' ? event.detail.newRated : this.currentRated;

    this.unloadCurrentImages();
    this.scrollToTop();
    this.updateUrl();

    document.dispatchEvent(new CustomEvent('imagegrid:params:changed'));
  }

  handleFilterChange(event) {
    this.currentPage = 1;
    const action = event.detail.action;

    if (action === 'add') {
      this.currentTags.push(event.detail.tag);
    } else if (action === 'change') {
      if (event.detail.tags === '') {
        this.currentTags = [];
      } else {
        this.currentTags = event.detail.tags.split(',');
      }
    } else {
      this.currentTags.splice(this.currentTags.indexOf(event.detail.tag), 1);
    }

    this.unloadCurrentImages();
    this.scrollToTop();
    this.updateUrl();

    document.dispatchEvent(new CustomEvent('jumpto:page:changed', { detail: { newPage: 1 } }));
    document.dispatchEvent(new CustomEvent('imagegrid:params:changed'));
  }

  updateUrl() {
    const currentUrl = new URL(window.location.href);
    const urlParams = new URLSearchParams();
    const params = {
      page: this.currentPage > 1 ? this.currentPage : null,
      filters: this.currentTags.length > 0 ? this.currentTags.join(',') : null,
      sort: this.currentSort !== '' ? this.currentSort : null,
      rated: this.currentRated !== '' ? this.currentRated : null
    }

    for (const key in params) {
      if (params[key] !== null) {
        urlParams.set(key, params[key]);
      }
    }

    window.history.pushState({}, '', `${ currentUrl.origin }${ currentUrl.pathname }?${ urlParams.toString() }`);
  }
}

window.customElements.define('image-grid', ImageGrid);

class PaginationNav extends HTMLElement {
  constructor() {
    super();

    this.currentPage = 1;
    this.maxPages = 1;

    document.addEventListener('pagination:page:changed', this.renderPaginationNav.bind(this));
  }

  addNavEventListeners() {
    const navLinks = this.querySelectorAll('a');

    for (const link of navLinks) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const targetPage = e.target.innerText;

        if (targetPage.includes('Previous')) {
          this.currentPage = Number(this.currentPage) - 1;
        } else if (targetPage.includes('Next')) {
          this.currentPage = Number(this.currentPage) + 1;
        } else {
          this.currentPage = Number(targetPage);
        }

        document.dispatchEvent(new CustomEvent('jumpto:page:changed', { detail: { newPage: this.currentPage } }));
        document.dispatchEvent(new CustomEvent('page:changed', { detail: { newPage: this.currentPage } }));
      }.bind(this));
    }
  }

  renderPaginationNav(event) {
    this.currentPage = event.detail.currentPage;
    this.maxPages = event.detail.maxPages;

    const currentPage = this.currentPage;
    const maxPages = this.maxPages;

    const isNextNav = currentPage < maxPages;
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
    const upperBound = currentPage + neighbourPages < maxPages ? currentPage + neighbourPages : maxPages;

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
  }
}

window.customElements.define('pagination-nav', PaginationNav);

class JumpToPage extends HTMLElement {
  constructor() {
    super();

    this.opener = this.querySelector('[data-action="open-controls"]');
    this.controls = this.querySelector('.jump-to-page__controls');
    this.input = this.querySelector('input');
    this.plus = this.querySelector('[data-action="add"]');
    this.minus = this.querySelector('[data-action="subtract"]');
    this.maxPages = 1;

    this.opener.addEventListener('click', this.toggleControls.bind(this));
    this.plus.addEventListener('click', this.incrementPage.bind(this));
    this.minus.addEventListener('click', this.decrementPage.bind(this));
    this.input.addEventListener('input', this.onInput.bind(this));

    document.addEventListener('jumpto:changed', debounce(function (event) { this.handlePageChange(event); }).bind(this));
    document.addEventListener('jumpto:maximum:changed', this.setMaximum.bind(this));
    document.addEventListener('jumpto:page:changed', this.setPage.bind(this));
  }

  setMaximum(event) {
    this.maxPages = event.detail.maxPages;

    this.input.setAttribute('max', this.maxPages);
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
    if (event.detail.instance !== this) {
      return;
    }

    const newPage = Number(this.input.value) > 1 ? Number(this.input.value) : 1;
    
    document.dispatchEvent(new CustomEvent('page:changed', { detail: { newPage: newPage } }));
    document.dispatchEvent(new CustomEvent('jumpto:page:changed', { detail: { newPage: newPage } }));
  }

  setPage(event) {
    this.input.value = event.detail.newPage;
  }
}

window.customElements.define('jump-to-page', JumpToPage);

class ViewModal extends HTMLElement {
  constructor() {
    super();

    this.imageContainer = this.querySelector('.view-modal__image-container');
    this.infoContainer = this.querySelector('.view-modal__info-container');
    this.image = this.imageContainer.querySelector('img');
    this.filenameContainer = this.querySelector('.view-modal__filename p');
    this.tagsContainer = this.querySelector('.view-modal__tags');
    this.ratingControls = this.querySelectorAll('input[type="radio"]');
    this.closeButton = this.querySelector('[data-action="close-modal"]');
    this.nextButton = this.querySelector('[data-action="next-image"]');
    this.previousButton = this.querySelector('[data-action="previous-image"]');
    this.removeRatingButton = this.querySelector('[data-action="remove-rating"]');
    this.nextImage = null;
    this.previousImage = null;
    this.nextImageRating = null;
    this.previousImageRating = null;
    this.pageWrapper = document.querySelector('.page-wrapper');
    this.gridItem = null;

    this.addEventListener('click', this.blurModal.bind(this));
    this.closeButton.addEventListener('click', this.closeModal.bind(this));
    this.nextButton.addEventListener('click', this.changeImage.bind(this, 'next'));
    this.previousButton.addEventListener('click', this.changeImage.bind(this, 'previous'));
    this.removeRatingButton.addEventListener('click', this.removeRating.bind(this));

    document.addEventListener('modal:open', this.openModal.bind(this));

    for (const ratingControl of this.ratingControls) {
      ratingControl.addEventListener('change', this.sendRatingChangedEvent.bind(this));
    }

    document.addEventListener('rating:changed', debounce(function (event) { this.handleRatingChange(event); }).bind(this));
  }

  setRatingControls(convertedRating) {
    if (convertedRating === null ) {
      for (const control of this.ratingControls) {
        control.checked = false;
      }

      this.removeRatingButton.classList.add('hidden');

      return;
    }

    for (const control of this.ratingControls) {
      if (control.value === convertedRating.toString()) {
        control.checked = true;
      } else {
        control.checked = false;
      }
    }

    this.removeRatingButton.classList.remove('hidden');
  }

  async setTags(filename) {
    const tags = await fetch('/gettags?filename=' + filename, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(function (response) {
      if (response.status !== 200) {
        document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "Couldn't fetch tags" } }));
        return null;
      }

      return response.json();
    }).then(function (data) {
      return (data !== null ? data.tags : null);
    });

    if (tags === null) {
      return;
    }

    const UrlActiveTags = new URL(window.location.href).searchParams.get('filters') || '';
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
  }

  openModal(event) {
    this.gridItem = event.detail.gridItem;

    const isUnrated = this.gridItem.classList.contains('rating-removed');
    const imageSrc = event.detail.imageSrc;

    this.image.src = imageSrc;

    const tempImg = new Image();
    tempImg.src = imageSrc;

    tempImg.onload = async function () {
      const filename = imageSrc.split('=')[1];
      const promises = isUnrated === true ? [this.setTags(filename)] : [this.getNeibourImages(filename), this.setTags(filename)];

      await Promise.all(promises);

      const imageRating = typeof event.detail.imageRating !== 'undefined' ? Number(event.detail.imageRating) : null;
      const convertedRating = convertRating(imageRating);
      this.setRatingControls(convertedRating);

      this.filenameContainer.innerText = filename;

      this.pageWrapper.classList.add('blurred');
      document.documentElement.classList.add('overflow-hidden');
      this.classList.remove('hidden');
      this.infoContainer.classList.remove('hidden');
    }.bind(this);
  }

  closeModal() {
    this.pageWrapper.classList.remove('blurred');
    document.documentElement.classList.remove('overflow-hidden');
    this.classList.add('hidden');
  }

  blurModal(event) {
    if (event.target.closest('.view-modal__inner') !== null) {
      return;
    }

    this.closeModal();
  }

  sendRatingChangedEvent(event) {
    document.dispatchEvent(new CustomEvent('rating:changed', { detail: { rating: event.target.value } }));
  }

  handleRatingChange(event) {
    const rating = Number(event.detail.rating);
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
        const rank = ratingToRank(rating);
        const rankColor = getRankColor(rank);

        this.gridItem.dataset.rating = rating;
        this.gridItem.dataset.rank = rank;
        this.gridItem.style.setProperty('--rank-color', rankColor.rankColor);
        this.gridItem.style.setProperty('--rank-color-dark', rankColor.rankColorDark);
        this.gridItem.classList.remove('rating-removed');
        this.gridItem.classList.remove('not-rated');
        this.removeRatingButton.classList.remove('hidden');

        document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'success', message: 'Rating updated' } }));
      } else {
        document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: 'Rating update failed' } }));
      }
    }.bind(this));
  }

  async removeRating() {
    const selectedRating = this.querySelector('input[name="rating"]:checked');
    const filename = this.filenameContainer.innerText;

    if (selectedRating === null) {
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "Cannot remove rating from unrated entry" } }));
      return;
    }

    const response = await fetch('/removerating?filename=' + filename, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status !== 200) {
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "Remove rating failed" } }));
      return;
    }

    selectedRating.checked = false;
    this.removeRatingButton.classList.add('hidden');
    this.gridItem.classList.add('rating-removed');
    this.gridItem.removeAttribute('data-rating');

    document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'success', message: 'Rating removed' } }));
  }

  async getNeibourImages(fileName) {
    const currentTags = new URL(window.location.href).searchParams.get('filters') || '';
    const currentSort = new URL(window.location.href).searchParams.get('sort') || '';
    const currentRated = new URL(window.location.href).searchParams.get('rated') || '';
    const tagsQuery = currentTags !== '' ? `&filters=${ currentTags }` : '';
    const sortQuery = currentSort !== '' ? `&sort=${ currentSort }` : '';
    const ratedQuery = currentRated !== '' ? `&rated=${ currentRated }` : '';

    this.nextButton.classList.add('hidden');
    this.previousButton.classList.add('hidden');

    const response = await fetch(`/getimageneighbours?filename=${ fileName }${ tagsQuery }${ sortQuery }${ ratedQuery }`);

    if (response.status !== 200) {
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "Couldn't fetch neighbour images" } }));
      return;
    }

    const result = await response.json();

    if (result.next_image.image !== null) {
      this.nextImage = result.next_image.image;
      this.nextImageRating = result.next_image.rating;
      this.nextButton.classList.remove('hidden');
    } else {
      this.nextImage = null;
    }

    if (result.prev_image.image !== null) {
      this.previousImage = result.prev_image.image;
      this.previousImageRating = result.prev_image.rating;
      this.previousButton.classList.remove('hidden');
    } else {
      this.previousImage = null;
    }

    return result;
  }

  changeImage(direction) {
    const currentPage = new URL(window.location.href).searchParams.get('page') || 1;
    const currentFileName = direction === 'next' ? this.nextImage : this.previousImage;
    const currentRating = direction === 'next' ? this.nextImageRating : this.previousImageRating;

    if (currentFileName === null) {
      return;
    }

    this.image.classList.add('hidden');
    this.infoContainer.classList.add('hidden');
    this.nextButton.disabled = true;
    this.previousButton.disabled = true;

    this.getNeibourImages(currentFileName).then(function (result) {
      this.nextButton.disabled = false;
      this.previousButton.disabled = false;

      const supposedPage = direction === 'next' ? Math.ceil((result.position + 1) / 60) : Math.ceil((result.position -1) / 60);

      setTimeout(function () {
        this.setTags(currentFileName).then(function () {
          this.setRatingControls(convertRating(currentRating));

          this.filenameContainer.innerText = currentFileName;
          this.infoContainer.classList.remove('hidden');

          this.image.src = `/getimage?filename=${ currentFileName }`;
          this.image.classList.add('lazyload');
          this.image.classList.remove('hidden');
        }.bind(this));
      }.bind(this), 200);

      if (supposedPage !== Number(currentPage) && supposedPage >= 1) {
        document.dispatchEvent(new CustomEvent('page:changed', { detail: { newPage: supposedPage } }));
      }
    }.bind(this));
  }
}

window.customElements.define('view-modal', ViewModal);

class ViewStats extends HTMLElement {
  constructor() {
    super();

    this.opener = document.querySelector('[data-action="open-stats"]');
    this.closeButton = this.querySelector('[data-action="close-stats"]');
    this.statsContainer = this.querySelector('.view-stats__inner');
    this.ratingInfoContainer = this.querySelector('.view-stats__rating-info');
    this.backendInfoContainer = this.querySelector('.view-stats__backend-info');
    this.statsInfoCurrentTraining = this.querySelector('.view-stats__current-training');
    this.diagram = null;
    this.diagramContainer = this.querySelector('.view_stats__diagram-container');
    this.pageWrapper = document.querySelector('.page-wrapper');
    this.resizeEventListener = debounce(function () { this.resizeChart() }.bind(this), 250);

    this.addEventListener('click', this.blurModal.bind(this));
    this.opener.addEventListener('click', this.openStats.bind(this));
    this.closeButton.addEventListener('click', this.closeStats.bind(this));
  }

  openStats() {
    fetch('/getstats').then(function (response) {
      if (response.status !== 200) {
        document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "Couldn't fetch stats" } }));
        return null;
      }

      return response.json();
    }).then(function (data) {
      if (data === null) {
        return;
      }

      document.dispatchEvent(new CustomEvent('sidemenu:close'));

      if (window.echartsLoaded === true) {
        this.diagram = this.loadChart(data);
        this.setDiagram(this.diagram);

        this.resizeChart();

        window.addEventListener('resize', this.resizeEventListener);
      }

      this.setInfo(data);

      this.classList.remove('hidden');
      this.opener.classList.add('open');

      this.pageWrapper.classList.add('blurred');
      document.documentElement.classList.add('overflow-hidden');
    }.bind(this));
  }

  blurModal(event) {
    if (event.target.closest('.view-stats__inner') !== null) {
      return;
    }

    this.closeStats();
  }

  resizeChart() {
    this.diagram.chart.resize();
  }

  closeStats() {
    this.classList.add('hidden');
    this.statsInfoCurrentTraining.classList.add('hidden');
    this.opener.classList.remove('open');
    this.pageWrapper.classList.remove('blurred');
    document.documentElement.classList.remove('overflow-hidden');

    window.removeEventListener('resize', this.resizeEventListener);
  }

  setInfo(data) {
    const ratingInfo = {
      "Image Count": data.image_count
    };
    const backendData = {
      "Personal model status": data.RaterNNP_up_to_date === true ? 'Up to date' : 'Outdated',
      "Global model status": data.RaterNNP_up_to_date === true ? 'Up to date' : 'Outdated',
      "Training status": (data.trainer === null || !data.trainer.is_training) ? 'Not training' : 'Training',
    };

    if (data.trainer !== null && data.trainer.is_training) {
      this.statsInfoCurrentTraining.classList.remove('hidden');
      this.statsInfoCurrentTraining.querySelector('.current-user').innerHTML = `Current user: ${ data.trainer.current_user}`;
      this.statsInfoCurrentTraining.querySelector('.current-progress').innerHTML = `Progress: ${ data.trainer.progress }`;
    }

    let ratingHtml = '';
    let backendHtml = '';

    for (const key in ratingInfo) {
      ratingHtml += `<p>${ key }: <span>${ ratingInfo[key] }</span></p>`;
    }

    for (const key in backendData) {
      backendHtml += `<p>${ key }: <span>${ backendData[key] }</span></p>`;
    }

    this.ratingInfoContainer.innerHTML = ratingHtml;
    this.backendInfoContainer.innerHTML = backendHtml; 
  }

  loadChart(data) {
    const ratingDistribution = data.rating_distribution;
    const ratings = [
      { name: "SS", value: ratingDistribution[6] },
      { name: "S", value: ratingDistribution[5] },
      { name: "A", value: ratingDistribution[4] },
      { name: "B", value: ratingDistribution[3] },
      { name: "C", value: ratingDistribution[2] },
      { name: "D", value: ratingDistribution[1] },
      { name: "F", value: ratingDistribution[0] }
    ];
    const colors = window.rankColors;
    const chartConfig = {
      title: {
        text: 'Rating distribution',
        left: 'center',
        top: 15,
      },
      tooltip: {
        trigger: 'item'
      },
      series: [
        {
          type: 'pie',
          radius: '70%',
          data: ratings,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          label: {
            show: true,
            formatter: function (params) { return Math.round(params.percent) + '%'; },
            position: 'inside',
            fontWeight: 'bold',
          }
        }
      ],
      legend: {
        orient: 'vertical',
        left: 5,
        top: 15
      },
      color: colors,
      backgroundColor: '#3b4252'
    };

    const chart = window.echarts.init(this.diagramContainer, 'dark', { resize: true });

    return {
      chart: chart,
      chartConfig: chartConfig
    };
  }

  setDiagram(data) {
    const chart = data.chart;
    const chartConfig = data.chartConfig;

    chart.setOption(chartConfig);
  }
}

window.customElements.define('view-stats', ViewStats);

class ToastMessage extends HTMLElement {
  constructor() {
    super();

    this.messageContainer = this.querySelector('.content');
    this.type = this.dataset.type;

    document.addEventListener('toast:show', this.showToast.bind(this));
  }

  showToast(event) {
    if (this.type !== event.detail.type) {
      return;
    }
  
    const message = event.detail.message;
    const self = this;
  
    function sendMessage(message) {
      this.messageContainer.innerText = message;
      this.classList.add('open');
  
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
  
      this.timeoutId = setTimeout(function () {
        this.classList.remove('open');
        this.timeoutId = null;
      }.bind(this), 5000);
    }
  
    const existingMessage = document.querySelector(`toast-message.open`);
  
    if (existingMessage !== null) {
      existingMessage.classList.remove('open');
  
      setTimeout(function () {
        sendMessage.call(self, message);
      }, 200);
  
      return;
    }
  
    sendMessage.call(self, message);
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

class TagSearch extends HTMLElement {
  constructor() {
    super();

    this.input = this.querySelector('input');
    this.searchButton = this.querySelector('[data-action="search"]');

    this.searchButton.addEventListener('click', this.handleSearch.bind(this));
    this.input.addEventListener('keydown', this.handleInputSearch.bind(this));

    document.addEventListener('tagsearch:tags:set', this.setTags.bind(this));
  }

  handleSearch() {
    const searchQuery = this.input.value;

    document.dispatchEvent(new CustomEvent('jumpto:page:changed', { detail: { newPage: 1 } }));
    document.dispatchEvent(new CustomEvent('filter:tags:changed', { detail: { action: 'change', tags: searchQuery } }));
  }

  handleInputSearch(event) {
    if (event.keyCode !== 13) {
      return;
    }

    const searchQuery = this.input.value;

    document.dispatchEvent(new CustomEvent('jumpto:page:changed', { detail: { newPage: 1 } }));
    document.dispatchEvent(new CustomEvent('filter:tags:changed', { detail: { action: 'change', tags: searchQuery } }));
  }

  setTags(event) {
    const tags = event.detail.tags;

    this.input.value = tags.join(',');
  }
}

window.customElements.define('tag-search', TagSearch);

class SortOptions extends HTMLElement {
  constructor() {
    super();

    this.opener = this.querySelector('[data-action="toggle-sort-options"]');
    this.currentSort = new URL(window.location.href).searchParams.get('sort') || 'date-desc';
    this.currentSortContainer = this.querySelector('[data-current]');
    this.sortOptions = this.querySelectorAll('input[type="radio"]');

    this.setCurrentSort();

    this.opener.addEventListener('click', this.toggleOptions.bind(this));

    for (const sortOption of this.sortOptions) {
      sortOption.addEventListener('change', this.handleSortChange.bind(this));
    }
  }

  toggleOptions() {
    this.classList.toggle('open');
  }

  setCurrentSort() {
    const currentSort = this.querySelector(`input[value="${ this.currentSort }"]`);

    currentSort.checked = true;
    this.currentSortContainer.innerText = currentSort.dataset.label;
  }

  handleSortChange(event) {
    const newSort = event.target.value;

    this.currentSort = newSort;

    this.setCurrentSort();

    document.dispatchEvent(new CustomEvent('jumpto:page:changed', { detail: { newPage: 1 } }));
    document.dispatchEvent(new CustomEvent('page:changed', { detail: { newPage: 1, newSort: newSort } }));
  }
}

window.customElements.define('sort-options', SortOptions);

class ViewOptions extends HTMLElement {
  constructor() {
    super();

    this.opener = this.querySelector('[data-action="toggle-view-options"]');
    this.currentRated = new URL(window.location.href).searchParams.get('rated') || 'yes';
    this.currentViewContainer = this.querySelector('[data-current]');
    this.viewOptions = this.querySelectorAll('input[type="radio"]');

    this.setCurrentView();

    this.opener.addEventListener('click', this.toggleOptions.bind(this));

    for (const viewOption of this.viewOptions) {
      viewOption.addEventListener('change', this.handleViewChange.bind(this));
    }
  }

  toggleOptions() {
    this.classList.toggle('open');
  }

  setCurrentView() {
    const currentRated = this.querySelector(`input[value="${ this.currentRated }"]`);

    currentRated.checked = true;
    this.currentViewContainer.innerText = currentRated.dataset.label;
  }

  handleViewChange(event) {
    const newRated = event.target.value;

    this.currentRated = newRated;

    this.setCurrentView();

    document.dispatchEvent(new CustomEvent('jumpto:page:changed', { detail: { newPage: 1 } }));
    document.dispatchEvent(new CustomEvent('page:changed', { detail: { newPage: 1, newRated: newRated } }));
  }
}

window.customElements.define('view-options', ViewOptions);

class FileUpload extends HTMLElement {
  constructor() {
    super();

    this.inner = this.querySelector('.file-upload__inner');
    this.loadingCircle = this.querySelector('.file-upload__loading-circle');
    this.opener = document.querySelector('[data-action="open-file-upload"]');
    this.closeButton = this.querySelector('.file-upload__close [data-action="close-file-upload"]');
    this.closeButtonAfter = this.querySelector('.file-upload__actions [data-action="close-file-upload"]');
    this.submitButton = this.querySelector('[data-action="upload-file"]');
    this.resetButton = this.querySelector('[data-action="upload-new-file"]');
    this.fileInput = this.querySelector('input[type="file"]');
    this.fileInputOpener = this.querySelector('[data-action="open-explorer"]');
    this.dropArea = this.querySelector('[data-drop-area]');
    this.ratingControls = this.querySelectorAll('input[type="radio"]');
    this.acceptedFileTypes = ["image/jpg", "image/jpeg", "image/png"];
    this.selectedRating = null;
    this.pageWrapper = document.querySelector('.page-wrapper');
    this.imagePreview = this.querySelector('.file-upload__image-preview img');
    this.hint = this.querySelector('.file__drop-area--hint');
    this.hintError = this.querySelector('.file__drop-area--hint-error');
    this.currentFile = null;

    this.addEventListener('click', this.blurModal.bind(this));
    this.opener.addEventListener('click', this.openFileUpload.bind(this));
    this.closeButton.addEventListener('click', this.closeFileUpload.bind(this));
    this.closeButtonAfter.addEventListener('click', this.closeFileUpload.bind(this));
    this.resetButton.addEventListener('click', this.resetFileUpload.bind(this));
    this.fileInputOpener.addEventListener('click', this.openFileInput.bind(this));
    this.fileInput.addEventListener('change', this.handleFileInput.bind(this));

    for (const ratingControl of this.ratingControls) {
      ratingControl.addEventListener('change', this.handleRatingChange.bind(this));
    }

    const dragEnterEvents = [
      'dragenter',
      'dragover'
    ];
    const dragLeaveEvents = [
      'dragleave',
      'drop'
    ];

    for (const dragEnterEvent of dragEnterEvents) {
      this.dropArea.addEventListener(dragEnterEvent, this.highlightArea.bind(this));
    }

    for (const dragLeaveEvent of dragLeaveEvents) {
      this.dropArea.addEventListener(dragLeaveEvent, this.unHighlightArea.bind(this));
    }

    this.dropArea.addEventListener('drop', this.handleFileDropped.bind(this));
    this.submitButton.addEventListener('click', this.uploadFile.bind(this));
  }

  openFileInput() {
    this.fileInput.click();
  }

  handleFileInput(event) {
    const files = event.target.files;

    this.handleFiles(files);
  }

  handleRatingChange(event) {
    const newValue = event.target.value;

    this.selectedRating = newValue;
  }

  openFileUpload() {
    this.classList.remove('hidden');
    this.pageWrapper.classList.add('blurred');
    document.documentElement.classList.add('overflow-hidden');

    document.dispatchEvent(new CustomEvent('sidemenu:close'));
  }

  blurModal(event) {
    if (event.target.closest('.file-upload__inner') !== null || this.classList.contains('loading')) {
      return;
    }

    this.closeFileUpload();
  }

  highlightArea(event) {
    event.preventDefault();
    event.stopPropagation();

    this.dropArea.classList.add('highlight');
  }

  unHighlightArea(event) {
    event.preventDefault();
    event.stopPropagation();

    this.dropArea.classList.remove('highlight');
  }

  showHint() {
    this.hint.classList.remove('hidden');
  }

  hideHint() {
    this.hint.classList.add('hidden');
  }

  showError() {
    this.hintError.classList.remove('hidden');
  }

  hideError() {
    this.hintError.classList.add('hidden');
  }

  closeFileUpload() {
    this.classList.add('hidden');
    this.pageWrapper.classList.remove('blurred');
    document.documentElement.classList.remove('overflow-hidden');

    this.resetFileUpload();
  }

  handleFileDropped(event) {
    event.preventDefault();
    event.stopPropagation();

    const dataTransfer = event.dataTransfer;
    const files = dataTransfer.files;

    this.handleFiles(files);
  }

  handleFiles(files) {
    const droppedFiles = Array.from(files);

    if (files.length > 1) {
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "Multiple file uploads is forbidden" } }));
      return;
    }

    const currentFile = droppedFiles[0];
    const preview = this.previewFile(currentFile);

    if (preview) {
      this.currentFile = preview;
      this.hideHint();
      this.hideError();
    }
  }

  async uploadFile() {
    if (this.currentFile === null) {
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "The provided file is empty" } }));
      return;
    }

    if (this.selectedRating === null) {
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "A rating must be provided" } }));
      return;
    }

    const extension = this.currentFile.name.split('.').pop();
    const formData = new FormData();

    formData.append('file', this.currentFile, generateRandomFilename(extension));
    formData.append('rating', this.selectedRating);

    this.classList.add('loading');
    this.inner.classList.add('blurred');
    this.loadingCircle.classList.remove('hidden');

    const response = await fetch('/uploadfile', {
      method: 'POST',
      body: formData
    });

    this.classList.remove('loading');
    this.inner.classList.remove('blurred');
    this.loadingCircle.classList.add('hidden');

    if (response.status !== 200) {
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "Server error" } }));
      return;
    }

    this.submitButton.classList.add('hidden');
    this.resetButton.classList.remove('hidden');
    this.closeButtonAfter.classList.remove('hidden');

    document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'success', message: "File has been uploaded" } }));
    document.dispatchEvent(new CustomEvent('page:changed', { detail: { newPage: 1 } }));
  }

  resetFileUpload() {
    setTimeout(function () {
      this.currentFile = null;

      const selectedRating = this.querySelector('input[type="radio"]:checked');
  
      if (selectedRating !== null) {
        selectedRating.checked = false;
      }
  
      this.submitButton.classList.remove('hidden');
      this.resetButton.classList.add('hidden');
      this.closeButtonAfter.classList.add('hidden');
      this.hint.classList.remove('hidden');
      this.hintError.classList.add('hidden');
      this.imagePreview.src = '';
    }.bind(this), 200);
  }

  previewFile(file) {
    const reader = new FileReader();
    const validFileType = this.acceptedFileTypes.includes(file.type);

    reader.readAsDataURL(file);
    reader.onloadend = function() {
      if (!validFileType) {
        this.imagePreview.src = '';
        this.hideHint();
        this.showError();
        document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "Invalid file type" } }));
      } else {
        this.imagePreview.src = reader.result;
        this.hideHint();
      }
    }.bind(this);

    if (!validFileType) {
      return false;
    }

    return file;
  }
}

window.customElements.define('file-upload', FileUpload);