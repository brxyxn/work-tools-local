package services

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type FileDialogs interface {
	OpenBase64TextFile() (string, error)
	SaveDecodedPDF(defaultName string) (string, error)
}

type OpenTextResult struct {
	Cancelled bool   `json:"cancelled"`
	Name      string `json:"name,omitempty"`
	Text      string `json:"text,omitempty"`
}

type SaveResult struct {
	Cancelled bool   `json:"cancelled"`
	Path      string `json:"path,omitempty"`
}

type FileService struct {
	dialogs FileDialogs
}

func NewFileService(dialogs FileDialogs) *FileService {
	return &FileService{dialogs: dialogs}
}

func (s *FileService) OpenBase64TextFile() (OpenTextResult, error) {
	path, err := s.dialogs.OpenBase64TextFile()
	if err != nil {
		return OpenTextResult{}, fmt.Errorf("choose Base64 text file: %w", err)
	}
	if path == "" {
		return OpenTextResult{Cancelled: true}, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return OpenTextResult{}, fmt.Errorf("read Base64 text file: %w", err)
	}
	return OpenTextResult{
		Name: filepath.Base(path),
		Text: strings.ToValidUTF8(string(data), "�"),
	}, nil
}

func (s *FileService) SaveDecodedPDF(defaultName string, data []byte) (SaveResult, error) {
	if len(data) < 4 || !bytes.Equal(data[:4], []byte("%PDF")) {
		return SaveResult{}, errors.New("decoded data is not a PDF file")
	}
	name := filepath.Base(defaultName)
	if name == "." || name == "" {
		name = "decoded.pdf"
	}
	if !strings.EqualFold(filepath.Ext(name), ".pdf") {
		name += ".pdf"
	}
	path, err := s.dialogs.SaveDecodedPDF(name)
	if err != nil {
		return SaveResult{}, fmt.Errorf("choose PDF destination: %w", err)
	}
	if path == "" {
		return SaveResult{Cancelled: true}, nil
	}
	if !strings.EqualFold(filepath.Ext(path), ".pdf") {
		path += ".pdf"
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return SaveResult{}, fmt.Errorf("save decoded PDF: %w", err)
	}
	return SaveResult{Path: path}, nil
}
