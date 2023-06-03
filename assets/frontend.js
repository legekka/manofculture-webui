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
  }
}

document.addEventListener('lazyloaded', function (e){
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
    
    this.gridItems = this.querySelectorAll('.grid-item');
    this.imagesData = [];

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

    const filtersQuery = this.currentTags.length > 0 ? `&filters=${ this.currentTags.join(',') }` : '';
    const sortQuery = this.currentSort !== '' ? `&sort=${ this.currentSort }` : '';

    const images = await fetch(`/getimages?&page=${ this.currentPage }${ filtersQuery }${ sortQuery }`);

    if (images.status !== 200) {
      this.imagesData = [];
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: 'Request timed out' } }));
      return;
    }

    const response = await images.json();

    this.imagesData = response.images;

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
        gridItem.setAttribute('data-rating', newRating);
        gridItem.setAttribute('data-rank', newRank);
        gridItem.style.setProperty('--rank-color', newRankColor.rankColor);
        gridItem.style.setProperty('--rank-color-dark', newRankColor.rankColorDark);
        imageElem.src = newImage
        imageElem.classList.add('lazyload');
      }, 200);

      setTimeout(function () {
        imageElem.classList.remove('transitioning');
      }, 400);
    }
  }

  handlePageChange(event) {
    this.currentPage = typeof event.detail.newPage !== 'undefined' ? event.detail.newPage : this.currentPage;
    this.currentTags = typeof event.detail.newTags !== 'undefined' ? event.detail.newTags : this.currentTags;
    this.currentSort = typeof event.detail.newSort !== 'undefined' ? event.detail.newSort : this.currentSort;

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
      sort: this.currentSort !== '' ? this.currentSort : null
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

    document.addEventListener('modal:open', this.openModal.bind(this));

    for (const ratingControl of this.ratingControls) {
      ratingControl.addEventListener('change', this.sendRatingChangedEvent.bind(this));
    }

    document.addEventListener('rating:changed', debounce(function (event) { this.handleRatingChange(event); }).bind(this));
  }

  setRatingControls(convertedRating) {
    for (const control of this.ratingControls) {
      if (control.value === convertedRating.toString()) {
        control.checked = true;
      } else {
        control.checked = false;
      }
    }
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
      }

      return response.json();
    }).then(function (data) {
      return data.tags;
    });

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

    const imageSrc = event.detail.imageSrc;
    const imageRating = Number(event.detail.imageRating) || 0;
    const convertedRating = convertRating(imageRating);

    this.setRatingControls(convertedRating);

    this.image.src = imageSrc;

    const tempImg = new Image();
    tempImg.src = imageSrc;

    tempImg.onload = async function () {
      const filename = imageSrc.split('=')[1];

      await this.getNeibourImages(filename);

      this.filenameContainer.innerText = filename;

      this.setTags(filename);

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

        document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'success', message: 'Rating updated' } }));
      } else {
        document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: 'Rating update failed' } }));
      }
    }.bind(this));
  }

  async getNeibourImages(fileName) {
    const currentTags = new URL(window.location.href).searchParams.get('filters') || '';
    const currentSort = new URL(window.location.href).searchParams.get('sort') || '';
    const tagsQuery = currentTags !== '' ? `&filters=${ currentTags }` : '';
    const sortQuery = currentSort !== '' ? `&sort=${ currentSort }` : '';

    this.nextButton.classList.add('hidden');
    this.previousButton.classList.add('hidden');

    const response = await fetch(`/getimageneighbours?filename=${ fileName }${ tagsQuery }${ sortQuery }`);

    if (response.status !== 200) {
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { type: 'error', message: "Couldn't fetch neighbour images" } }));
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
      }

      return response.json();
    }).then(function (data) {
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

    const existingSameTypeMessage = document.querySelector(`toast-message[type="${ this.type }"].open`);

    if (existingSameTypeMessage !== null) {
      existingSameTypeMessage.classList.remove('open');
    }

    const message = event.detail.message;

    this.messageContainer.innerText = message;
    this.classList.add('open');

    setTimeout(function () {
      this.classList.remove('open');
    }.bind(this), 3000);
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