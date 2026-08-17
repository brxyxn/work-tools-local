package main

import "testing"

func TestMainWindowUsesToolbarFreeFullSizeTitleBar(t *testing.T) {
	options := mainWindowOptions()

	if options.Mac.TitleBar.UseToolbar {
		t.Fatal("main window must not use a native toolbar")
	}
	if !options.Mac.TitleBar.FullSizeContent {
		t.Fatal("main window must keep full-size content")
	}
}
