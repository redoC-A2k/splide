import {
  ALL_ATTRIBUTES,
  ARIA_CONTROLS,
  ARIA_CURRENT,
  ARIA_HIDDEN,
  ARIA_LABEL,
  ARIA_ROLEDESCRIPTION,
  ROLE,
  TAB_INDEX,
} from '../../constants/attributes';
import {
  CLASS_ACTIVE,
  CLASS_CONTAINER,
  CLASS_NEXT,
  CLASS_PREV,
  CLASS_VISIBLE,
  STATUS_CLASSES,
} from '../../constants/classes';
import {
  EVENT_ACTIVE,
  EVENT_CLICK,
  EVENT_HIDDEN,
  EVENT_INACTIVE,
  EVENT_MOVE,
  EVENT_MOVED,
  EVENT_NAVIGATION_MOUNTED,
  EVENT_REFRESH,
  EVENT_REPOSITIONED,
  EVENT_SCROLLED,
  EVENT_SHIFTED,
  EVENT_SLIDE_KEYDOWN,
  EVENT_VISIBLE,
} from '../../constants/events';
import { FADE, LOOP } from '../../constants/types';
import { EventInterface } from '../../constructors';
import { Splide } from '../../core/Splide/Splide';
import { BaseComponent } from '../../types';
import {
  abs, apply,
  ceil,
  child,
  floor,
  focus,
  format,
  getAttribute,
  hasClass,
  min,
  nextTick,
  pad,
  queryAll,
  rect,
  removeAttribute,
  removeClass,
  setAttribute,
  style as _style,
  toggleClass,
} from '../../utils';


/**
 * The interface for the Slide sub component.
 *
 * @since 3.0.0
 */
export interface  SlideComponent extends BaseComponent {
  index: number;
  slideIndex: number;
  slide: HTMLElement;
  container: HTMLElement;
  isClone: boolean;
  update(): void;
  style( prop: string, value: string | number, useContainer?: boolean ): void
  isWithin( from: number, distance: number ): boolean;
}

/**
 * The sub component for managing each slide.
 *
 * @since 3.0.0
 *
 * @param Splide     - A Splide instance.
 * @param index      - A slide index.
 * @param slideIndex - A slide index for clones. This must be `-1` if the slide is not a clone.
 * @param slide      - A slide element.
 *
 * @return A Slide sub component.
 */
export function Slide( Splide: Splide, index: number, slideIndex: number, slide: HTMLElement ): SlideComponent {
  const { on, emit, bind, destroy: destroyEvents } = EventInterface( Splide );
  const { Components, root, options } = Splide;
  const { isNavigation, updateOnMove, i18n, pagination } = options;
  const { resolve } = Components.Direction;
  const styles    = getAttribute( slide, 'style' );
  const isClone   = slideIndex > -1;
  const container = child( slide, `.${ CLASS_CONTAINER }` );

  /**
   * Turns into `true` when the component is destroyed.
   */
  let destroyed: boolean;

  /**
   * Called when the component is mounted.
   */
  function mount( this: SlideComponent ): void {
    if ( ! isClone ) {
      slide.id = `${ root.id }-slide${ pad( index + 1 ) }`;
      setAttribute( slide, ROLE, pagination ? 'tabpanel' : 'group' );
      setAttribute( slide, ARIA_ROLEDESCRIPTION, pagination ? '' : i18n.slide );
      setAttribute( slide, ARIA_LABEL, format( i18n.slideLabel, [ index + 1, Splide.length ] ) );
    }

    listen();
  }

  /**
   * Listens to some events.
   */
  function listen(): void {
    bind( slide, 'click', apply( emit, EVENT_CLICK, self ) );
    bind( slide, 'keydown', apply( emit, EVENT_SLIDE_KEYDOWN, self ) );

    on( [ EVENT_REFRESH, EVENT_REPOSITIONED, EVENT_SHIFTED, EVENT_MOVED, EVENT_SCROLLED ], update );
    on( [ EVENT_REFRESH, EVENT_REPOSITIONED, EVENT_MOVED, EVENT_SCROLLED ], updateAria );
    on( EVENT_NAVIGATION_MOUNTED, initNavigation );

    if ( updateOnMove ) {
      on( EVENT_MOVE, onMove );
    }
  }

  /**
   * Destroys the component.
   */
  function destroy(): void {
    destroyed = true;
    destroyEvents();
    removeClass( slide, STATUS_CLASSES );
    removeAttribute( slide, ALL_ATTRIBUTES );
    setAttribute( slide, 'style', styles );
  }

  /**
   * Initializes slides as navigation.
   */
  function initNavigation(): void {
    const controls = Splide.splides.map( target => {
      const Slide = target.splide.Components.Slides.getAt( index );
      return Slide ? Slide.slide.id : '';
    } ).join( ' ' );

    setAttribute( slide, ARIA_LABEL, format( i18n.slideX, ( isClone ? slideIndex : index ) + 1 ) );
    setAttribute( slide, ARIA_CONTROLS, controls );
    updateActivity( isActive() );
  }

  /**
   * If the `updateOnMove` option is `true`, called when the slider starts moving.
   */
  function onMove(): void {
    if ( ! destroyed ) {
      update();
    }
  }

  /**
   * Updates attribute and classes of the slide.
   */
  function update(): void {
    if ( ! destroyed ) {
      const { index: curr } = Splide;

      updateActivity( isActive() );
      updateVisibility( isVisible() );

      toggleClass( slide, CLASS_PREV, index === curr - 1 );
      toggleClass( slide, CLASS_NEXT, index === curr + 1 );
    }
  }

  /**
   * Updates the status related with activity.
   *
   * @param active - Set `true` if the slide is active.
   */
  function updateActivity( active: boolean ): void {
    if ( active !== hasClass( slide, CLASS_ACTIVE ) ) {
      toggleClass( slide, CLASS_ACTIVE, active );
      setAttribute( slide, ARIA_CURRENT, isNavigation && active || '' );
      emit( active ? EVENT_ACTIVE : EVENT_INACTIVE, self );
    }
  }

  /**
   * Updates classes and attributes related with visibility.
   *
   * @param visible - Set `true` if the slide is visible.
   */
  function updateVisibility( visible: boolean ): void {
    const hidden = ! visible && ( ! isActive() || isClone );

    if ( document.activeElement === slide && hidden ) {
      nextTick( keepFocus );
    }

    setAttribute( slide, TAB_INDEX, ! hidden && options.slideFocus ? 0 : '' );
    setAttribute( queryAll( slide, options.focusableNodes || '' ), TAB_INDEX, hidden ? -1 : '' );

    if ( visible !== hasClass( slide, CLASS_VISIBLE ) ) {
      toggleClass( slide, CLASS_VISIBLE, visible );
      emit( visible ? EVENT_VISIBLE : EVENT_HIDDEN, self );
    }
  }

  /**
   * Updates aria attributes.
   *
   * @todo
   */
  function updateAria(): void {
    const hidden = ! isVisible() && ( ! isActive() || isClone );
    setAttribute( slide, ARIA_HIDDEN, hidden || '' );
  }

  /**
   * Forwards the focus to the active element.
   * Avoid losing focus from the slider when the focused slide gets hidden by slider move.
   */
  function keepFocus(): void {
    const Slide = Components.Slides.getAt( Splide.index );

    if ( Slide ) {
      focus( Slide.slide );
    }
  }

  /**
   * Adds a CSS rule to the slider or the container.
   *
   * @param prop         - A property name.
   * @param value        - A CSS value to add.
   * @param useContainer - Optional. Determines whether to apply the rule to the container or not.
   */
  function style( prop: string, value: string | number, useContainer?: boolean ): void {
    _style( ( useContainer && container ) || slide, prop, value );
  }

  /**
   * Checks if the slide is active or not.
   *
   * @return `true` if the slide is active.
   */
  function isActive(): boolean {
    const { index: curr } = Splide;
    return curr === index || ( options.cloneStatus && curr === slideIndex );
  }

  /**
   * Checks if the slide is visible or not.
   */
  function isVisible(): boolean {
    if ( Splide.is( FADE ) ) {
      return isActive();
    }

    const trackRect = rect( Components.Elements.track );
    const slideRect = rect( slide );
    const left      = resolve( 'left' );
    const right     = resolve( 'right' );

    return floor( trackRect[ left ] ) <= ceil( slideRect[ left ] )
      && floor( slideRect[ right ] ) <= ceil( trackRect[ right ] );
  }

  /**
   * Calculates how far this slide is from another slide and
   * returns `true` if the distance is within the given number.
   *
   * @param from     - An index of a base slide.
   * @param distance - `true` if the slide is within this number.
   *
   * @return `true` if the slide is within the `distance` from the base slide, or otherwise `false`.
   */
  function isWithin( from: number, distance: number ): boolean {
    let diff = abs( from - index );

    if ( ! isClone && ( options.rewind || Splide.is( LOOP ) ) ) {
      diff = min( diff, Splide.length - diff );
    }

    return diff <= distance;
  }

  const self = {
    index,
    slideIndex,
    slide,
    container,
    isClone,
    mount,
    destroy,
    update,
    style,
    isWithin,
  };

  return self;
}
