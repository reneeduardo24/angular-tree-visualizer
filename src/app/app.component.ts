import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TreeNode, TreeViewerComponent } from "./components/tree-viewer/tree-viewer.component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TreeViewerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
}
