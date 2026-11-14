import React,{Component,Suspense} from 'react';

// A failed optional chunk must not take the navigation or audio player down.
export default class DeferredPanel extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <section aria-label={this.props.label}>
      <p role="status">No pudimos cargar esta sección. Recargá la página para volver a intentar.</p>
      <button className="outline" onClick={()=>window.location.reload()}>Recargar página</button>
    </section>;
    return <Suspense fallback={<p role="status">Cargando {this.props.label}…</p>}>{this.props.children}</Suspense>;
  }
}
