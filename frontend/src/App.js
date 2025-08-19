import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import AppNavbar from './components/AppNavbar';
import Swap from './components/Swap';

function App() {
  return (
    <div className="App">
      <AppNavbar />
      <Swap /> 
    </div>
  );
}

export default App;