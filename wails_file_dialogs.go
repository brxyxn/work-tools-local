package main

import (
	"errors"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type wailsFileDialogs struct {
	manager *application.DialogManager
}

func (d *wailsFileDialogs) setManager(manager *application.DialogManager) {
	d.manager = manager
}

func (d *wailsFileDialogs) OpenBase64TextFile() (string, error) {
	if d.manager == nil {
		return "", errors.New("dialog manager is unavailable")
	}
	return d.manager.OpenFileWithOptions(&application.OpenFileDialogOptions{
		CanChooseFiles:  true,
		ResolvesAliases: true,
		Title:           "Open Base64 Text",
		ButtonText:      "Open",
		Filters: []application.FileFilter{
			{DisplayName: "Text files", Pattern: "*.txt"},
		},
	}).PromptForSingleSelection()
}

func (d *wailsFileDialogs) SaveDecodedPDF(defaultName string) (string, error) {
	if d.manager == nil {
		return "", errors.New("dialog manager is unavailable")
	}
	return d.manager.SaveFileWithOptions(&application.SaveFileDialogOptions{
		CanCreateDirectories: true,
		Title:                "Save Decoded PDF",
		ButtonText:           "Save",
		Filename:             defaultName,
		Filters: []application.FileFilter{
			{DisplayName: "PDF documents", Pattern: "*.pdf"},
		},
	}).PromptForSingleSelection()
}
