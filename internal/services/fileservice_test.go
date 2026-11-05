package services

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

type fakeFileDialogs struct {
	openPath    string
	savePath    string
	diagramPath string
}

func (f fakeFileDialogs) OpenBase64TextFile() (string, error)        { return f.openPath, nil }
func (f fakeFileDialogs) SaveDecodedPDF(string) (string, error)      { return f.savePath, nil }
func (f fakeFileDialogs) SaveDiagram(string, string) (string, error) { return f.diagramPath, nil }

func TestFileServiceTreatsDialogCancellationAsSuccess(t *testing.T) {
	service := NewFileService(fakeFileDialogs{})
	opened, err := service.OpenBase64TextFile()
	if err != nil || !opened.Cancelled {
		t.Fatalf("open result = %#v, err = %v", opened, err)
	}
	saved, err := service.SaveDecodedPDF("decoded.pdf", []byte("%PDF-test"))
	if err != nil || !saved.Cancelled {
		t.Fatalf("save result = %#v, err = %v", saved, err)
	}
}

func TestFileServiceReadsTextAndWritesPDF(t *testing.T) {
	dir := t.TempDir()
	textPath := filepath.Join(dir, "payload.txt")
	if err := os.WriteFile(textPath, []byte("JVBERi0="), 0o600); err != nil {
		t.Fatal(err)
	}
	pdfPath := filepath.Join(dir, "decoded.pdf")
	service := NewFileService(fakeFileDialogs{openPath: textPath, savePath: pdfPath})

	opened, err := service.OpenBase64TextFile()
	if err != nil {
		t.Fatal(err)
	}
	if opened.Cancelled || opened.Name != "payload.txt" || opened.Text != "JVBERi0=" {
		t.Fatalf("open result = %#v", opened)
	}

	saved, err := service.SaveDecodedPDF("decoded.pdf", []byte("%PDF-test"))
	if err != nil {
		t.Fatal(err)
	}
	if saved.Cancelled || saved.Path != pdfPath {
		t.Fatalf("save result = %#v", saved)
	}
	bytes, err := os.ReadFile(pdfPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(bytes) != "%PDF-test" {
		t.Fatalf("saved bytes = %q", bytes)
	}
}

func TestFileServiceRejectsNonPDFBytes(t *testing.T) {
	service := NewFileService(fakeFileDialogs{savePath: filepath.Join(t.TempDir(), "decoded.pdf")})
	if _, err := service.SaveDecodedPDF("decoded.pdf", []byte("not a pdf")); err == nil {
		t.Fatal("non-PDF bytes unexpectedly saved")
	}
}

func TestFileServiceAddsPDFExtensionToSelectedDestination(t *testing.T) {
	dir := t.TempDir()
	service := NewFileService(fakeFileDialogs{savePath: filepath.Join(dir, "decoded")})

	saved, err := service.SaveDecodedPDF("decoded.pdf", []byte("%PDF-test"))
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(dir, "decoded.pdf")
	if saved.Path != want {
		t.Fatalf("saved path = %q, want %q", saved.Path, want)
	}
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("stat saved PDF: %v", err)
	}
}

var pngBytes = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")

func TestFileServiceSavesEachDiagramFormat(t *testing.T) {
	dir := t.TempDir()
	cases := []struct {
		format string
		data   []byte
	}{
		{"png", pngBytes},
		{"jpg", []byte{0xFF, 0xD8, 0xFF, 0xE0}},
		{"svg", []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`)},
	}
	for _, testCase := range cases {
		want := filepath.Join(dir, "diagram."+testCase.format)
		service := NewFileService(fakeFileDialogs{diagramPath: want})

		saved, err := service.SaveDiagram("diagram."+testCase.format, testCase.format, testCase.data)
		if err != nil {
			t.Fatalf("%s: %v", testCase.format, err)
		}
		if saved.Cancelled || saved.Path != want {
			t.Fatalf("%s saved = %#v, want path %q", testCase.format, saved, want)
		}
		written, err := os.ReadFile(want)
		if err != nil {
			t.Fatalf("%s: %v", testCase.format, err)
		}
		if !bytes.Equal(written, testCase.data) {
			t.Fatalf("%s written bytes = %q", testCase.format, written)
		}
	}
}

func TestFileServiceRejectsUnsupportedDiagramFormat(t *testing.T) {
	service := NewFileService(fakeFileDialogs{diagramPath: filepath.Join(t.TempDir(), "diagram.gif")})
	if _, err := service.SaveDiagram("diagram.gif", "gif", pngBytes); err == nil {
		t.Fatal("unsupported diagram format unexpectedly accepted")
	}
}

func TestFileServiceRejectsDiagramBytesThatDoNotMatchTheFormat(t *testing.T) {
	service := NewFileService(fakeFileDialogs{diagramPath: filepath.Join(t.TempDir(), "diagram.png")})
	if _, err := service.SaveDiagram("diagram.png", "png", []byte("<svg></svg>")); err == nil {
		t.Fatal("mismatched diagram bytes unexpectedly saved")
	}
}

func TestFileServiceNormalizesDiagramExtensions(t *testing.T) {
	dir := t.TempDir()
	service := NewFileService(fakeFileDialogs{diagramPath: filepath.Join(dir, "chart")})

	saved, err := service.SaveDiagram("chart.svg", "png", pngBytes)
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(dir, "chart.png")
	if saved.Path != want {
		t.Fatalf("saved path = %q, want %q", saved.Path, want)
	}
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("stat exported diagram: %v", err)
	}
}

func TestFileServiceTreatsDiagramDialogCancellationAsSuccess(t *testing.T) {
	service := NewFileService(fakeFileDialogs{})
	saved, err := service.SaveDiagram("diagram.png", "png", pngBytes)
	if err != nil || !saved.Cancelled {
		t.Fatalf("saved = %#v, err = %v", saved, err)
	}
}

func TestDiagramFileFilterCoversSupportedFormatsOnly(t *testing.T) {
	for _, format := range []string{"png", "JPG", " svg "} {
		if _, _, ok := DiagramFileFilter(format); !ok {
			t.Fatalf("format %q has no save dialog filter", format)
		}
	}
	if _, _, ok := DiagramFileFilter("gif"); ok {
		t.Fatal("unsupported format unexpectedly has a filter")
	}
}
